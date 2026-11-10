#!/usr/bin/env python3
"""Publish only web/ as a static gh-pages tree without changing the checkout.
Usage: python3 tools/publish-pages.py [--push]
Pages itself must be enabled in repository Settings > Pages, gh-pages / root.
"""
import argparse
import json
import os
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def git(*args, data=None, extra_env=None):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], input=data,
                                   env={**os.environ, **(extra_env or {})}).decode().strip()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--push',action='store_true')
    args=parser.parse_args()
    source=git('rev-parse','HEAD')
    source_tree=git('rev-parse','HEAD:web')
    required=['index.html','style.css','assets.js','game.js','weapons.js',
              'models/weapons-meshes.js','vendor/three.min.js']
    for path in required:
        git('cat-file','-e',f'HEAD:web/{path}')
    remote=git('ls-remote','origin','refs/heads/gh-pages')
    parent=[]
    if remote:
        previous=remote.split()[0]
        git('fetch','--no-tags','origin',previous)
        parent=['-p',previous]
    with tempfile.TemporaryDirectory(prefix='retro-pages-') as directory:
        env={'GIT_INDEX_FILE':str(Path(directory)/'index')}
        git('read-tree',source_tree,extra_env=env)
        nojekyll=git('hash-object','-w','--stdin',data=b'')
        git('update-index','--add','--cacheinfo',f'100644,{nojekyll},.nojekyll',extra_env=env)
        version=git('hash-object','-w','--stdin',data=json.dumps({'source_commit':source}).encode())
        git('update-index','--add','--cacheinfo',f'100644,{version},version.json',extra_env=env)
        tree=git('write-tree',extra_env=env)
    commit=git('commit-tree',tree,*parent,'-m',f'Publish browser game from {source[:12]}')
    print(f'Prepared static site: {commit}; source: {source}')
    if args.push:
        git('push','origin',f'{commit}:refs/heads/gh-pages')
        print('Uploaded gh-pages. Enable branch gh-pages / (root) in Settings > Pages.')
    else:
        print('Dry run: nothing pushed. Use --push to upload.')
if __name__=='__main__':
    main()
