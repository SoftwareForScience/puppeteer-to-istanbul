const fs = require('fs')
const OutputFiles = require('./output-files')
const mkdirp = require('mkdirp')
const PuppeteerToV8 = require('./puppeteer-to-v8')
const v8toIstanbul = require('v8-to-istanbul')
const url = require('url')

let jsonPart = {}

class PuppeteerToIstanbul {
  constructor (coverageInfo) {
    this.coverageInfo = coverageInfo
    this.puppeteerToConverter = OutputFiles(coverageInfo).getTransformedCoverage()
    this.puppeteerToV8Info = PuppeteerToV8(this.puppeteerToConverter).convertCoverage()
  }

  setCoverageInfo (coverageInfo) {
    this.coverageInfo = coverageInfo
  }

  writeIstanbulFormat () {
    mkdirp.sync('./.nyc_output')

    const outFilePath = './.nyc_output/out.json'

    fs.writeFileSync(outFilePath, '')

    const fd = fs.openSync(outFilePath, 'a')

    const validElements = this.puppeteerToV8Info.filter((jsFile) => {
      let path = jsFile.url;

      path = path.replace(/(\\|\/)\.nyc_output/, '');
      path = url.fileURLToPath(path)

      return fs.existsSync(path);
    });

    validElements.forEach((jsFile) => {
      const script = v8toIstanbul(jsFile.url)
      script.applyCoverage(jsFile.functions)

      let istanbulCoverage = script.toIstanbul()
      let keys = Object.keys(istanbulCoverage)

      const instanbulKey = keys[0];
      const filePath = instanbulKey.replace(/(\\|\/)\.nyc_output/, '')

      if (jsonPart[filePath]) {
        // Merge coverage records
        mergeCoverageData(jsonPart[filePath].s, istanbulCoverage[instanbulKey].s)
      } else {
        jsonPart[filePath] = istanbulCoverage[instanbulKey]
      }
      jsonPart[filePath].originalUrl = jsFile.originalUrl
      jsonPart[filePath].path = filePath
    })

    fs.writeSync(fd, '{')
    Object.keys(jsonPart).forEach((url, index, keys) => {
      const data = jsonPart[url]
      const isLastIteration = index === (keys.length - 1)

      fs.writeSync(fd, `${JSON.stringify(url)}: ${JSON.stringify(data)}${(isLastIteration ? '' : ',')}`)
    })
    fs.writeSync(fd, '}')
    fs.closeSync(fd)
  }
}

function mergeCoverageData (obja, objb) {
  Object.keys(obja).forEach(key => {
    obja[key] = (obja[key] || objb[key]) ? 1 : 0
  })
  return obja
}

function genPuppeteerToIstanbul (coverageInfo) {
  return new PuppeteerToIstanbul(coverageInfo)
}

genPuppeteerToIstanbul.resetJSONPart = function () {
  jsonPart = {}
}

genPuppeteerToIstanbul.getJSONPart = function () {
  return JSON.parse(JSON.stringify(jsonPart))
}

genPuppeteerToIstanbul.mergeCoverageData = mergeCoverageData

module.exports = genPuppeteerToIstanbul
