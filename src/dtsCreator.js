'use strict';

import process from 'process';
import fs from 'fs';
import path from'path';

import isThere from 'is-there';
import mkdirp from 'mkdirp';

import {TokenValidator} from './tokenValidator';
import FileSystemLoader from './fileSystemLoader';

let validator = new TokenValidator();

class DtsContent {
  constructor({
    rootDir,
    searchDir,
    outDir,
    rInputPath,
    rawTokenList,
    resultList,
    messageList
  }) {
    this.rootDir = rootDir;
    this.searchDir = searchDir;
    this.outDir = outDir;
    this.rInputPath = rInputPath;
    this.rawTokenList = rawTokenList;
    this.resultList = resultList;
    this.messageList = messageList;
  }

  get contents() {
    return this.resultList;
  }

  get formatted() {
    if(!this.resultList || !this.resultList.length) return null;
    return this.resultList.join('\n');
  }

  get tokens() {
    return this.rawTokenList;
  }

  get outputFilePath() {
    return path.join(this.rootDir, this.outDir, this.rInputPath + '.d.ts');
  }

  get inputFilePath() {
    return path.join(this.rootDir, this.searchDir, this.rInputPath);
  }

  writeFile() {
    var outPathDir = path.dirname(this.outputFilePath);
    if(!isThere(outPathDir)) {
      mkdirp.sync(outPathDir);
    }
    return new Promise((resolve, reject) => {
      fs.writeFile(this.outputFilePath, this.formatted, 'utf8', (err) => {
        if(err) {
          reject(err);
        }else{
          resolve(this);
        }
      });
    });
  }
}

export class DtsCreator {
  constructor(options) {
    if(!options) options = {};
    this.rootDir = options.rootDir || process.cwd();
    this.searchDir = options.searchDir || '';
    this.outDir = options.outDir || this.searchDir;
    this.loader = new FileSystemLoader(this.rootDir);
    this.inputDirectory = path.join(this.rootDir, this.searchDir);
    this.outputDirectory = path.join(this.rootDir, this.outDir);
  }

  create(filePath, clearCache = false) {
    return new Promise((resolve, reject) => {
      var rInputPath;
      if(path.isAbsolute(filePath)) {
        rInputPath = path.relative(this.inputDirectory, filePath);
      }else{
        rInputPath = path.relative(this.inputDirectory, path.join(process.cwd(), filePath));
      }
      if(clearCache) {
        this.loader.tokensByFile = {};
      }
      this.loader.fetch(filePath, "/").then(res => {
        if(res) {
          var tokens = res;
          var keys = Object.keys(tokens);
          var validKeys = [], invalidKeys = [];
          var messageList = [];

          keys.forEach(key => {
            var ret = validator.validate(key);
            if(ret.isValid) {
              validKeys.push(key);
            }else{
              messageList.push(ret.message);
            }
          });

          var result = validKeys.map(k => ('export const ' + k + ': string;'));

          var content = new DtsContent({
            rootDir: this.rootDir,
            searchDir: this.searchDir,
            outDir: this.outDir,
            rInputPath,
            rawTokenList: keys,
            resultList: result,
            messageList
          });

          resolve(content);
        }else{
          reject(res);
        }
      });
    });
  }
}
