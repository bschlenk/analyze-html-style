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
  const results = await octokit.search.code({
    q: 'style language:html',
  });

  results.data.items.forEach(async (item) => {
    if (item.path.startsWith('vendor/')) return;

    const blob = await octokit.git.getBlob({
      owner: item.repository.owner.login,
      repo: item.repository.name,
      file_sha: item.sha,
    });

    const content = decode(blob.data.content);
    const styles = extractStyleTags(content);

    if (styles.length) {
      console.log('%s:%s', item.repository.full_name, item.path);
      console.log(styles);
      console.log();
    }
  });
})();

function extractStyleTags(data) {
  const matches = [...data.matchAll(/style\s*=\s*"([^"]+)"/g)];
  return matches.map((m) => m[1]);
}

function decode(contents) {
  return Buffer.from(contents, 'base64').toString('ascii');
}
