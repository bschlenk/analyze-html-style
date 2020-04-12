// list top repos that contain html and have a style=" string somewhere

import os from 'os';
import fs from 'fs';
import path from 'path';
import MOctokit from '@octokit/rest';

const TOKEN = fs.readFileSync(
  path.join(os.userInfo().homedir, 'iCloudDrive', 'github_personal.token'),
  'utf-8',
);

const octokit = new MOctokit.Octokit({
  auth: TOKEN,
  userAgent: 'bschlenk/analyze-html-style',
});

(async () => {
  const out = fs.createWriteStream('./results.csv');

  for await (const item of codeSearch('style language:html')) {
    if (shouldSkip(item.path)) continue;

    const blob = await octokit.git.getBlob({
      owner: item.repository.owner.login,
      repo: item.repository.name,
      file_sha: item.sha,
    });

    await checkRateLimit(blob);

    const content = decode(blob.data.content);
    const data = analyzeStyles(content);

    if (data.total) {
      const file = `${item.repository.full_name}:${item.path}`;
      const percentSemi = ((data.semi / data.total) * 100).toFixed(2);

      console.log(file);
      console.log('  %s%% semi (%d total styles)', percentSemi, data.total);
      console.log();

      out.write(`${file},${data.semi},${data.nosemi},${data.total}\n`);
    }
  }

  out.close();
})();

async function* codeSearch(query) {
  let page = 1;

  while (true) {
    console.log('* fetching page %d of results', page);

    const results = await handleAbuseDetection(() =>
      octokit.search.code({
        q: query,
        page,
      }),
    );

    console.log(results.headers.link);

    if (results.data.items.length === 0) {
      break;
    }

    for (const item of results.data.items) {
      yield item;
    }

    ++page;

    await checkRateLimit(results);
  }
}

function analyzeStyles(fileContents) {
  let semi = 0;
  let nosemi = 0;

  const styles = extractStyleTags(fileContents);
  for (const s of styles) {
    if (s.trim().endsWith(';')) {
      ++semi;
    } else {
      ++nosemi;
    }
  }

  return {
    semi,
    nosemi,
    total: styles.length,
  };
}

function wait(time) {
  return new Promise((res) => setTimeout(res, time));
}

function extractStyleTags(data) {
  const matches = [...data.matchAll(/style\s*=\s*"([^"]+)"/g)];
  return matches.map((m) => m[1]);
}

function decode(contents) {
  return Buffer.from(contents, 'base64').toString('ascii');
}

function shouldSkip(fname) {
  return fname.startsWith('vendor/') || fname.endsWith('.py.html');
}

async function checkRateLimit(response) {
  const {
    'x-ratelimit-limit': limit,
    'x-ratelimit-remaining': remaining,
    'x-ratelimit-reset': reset,
  } = response.headers;

  console.log(
    '* rate limit: %s, remaining: %s, reset: %s',
    limit,
    remaining,
    reset,
  );

  if (remaining == 0) {
    const toWait = Math.max(0, parseInt(reset) - Date.now());
    console.log('* rate limit exceeded - waiting %d ms', toWait);
    await wait(toWait);
  }
}

async function handleAbuseDetection(fn) {
  let retries = 0;
  while (retries < 3) {
    try {
      return await fn();
    } catch (err) {
      const retryAfter = err.headers['retry-after'];
      console.log(
        '* triggered abuse detection! waiting for %s seconds (%s)',
        retryAfter,
        err,
      );
      await wait(1000 * retryAfter);
      ++retries;
    }
  }
}
