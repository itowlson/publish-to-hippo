const path = require('path');

const core = require('@actions/core');

const download = require('download');
const mkdirp = require('mkdirp');
const shelljs = require('shelljs');
const tar = require('tar');

const HF_VERSION = '0.5.0';
const HF_WORKING_DIR = './.hippotools';

try {
    const canary = core.getBooleanInput('canary');
    const specPath = core.getInput('specPath');

    const result = await publishToHippo(canary, specPath);
    if (result.succeeded) {
        console.log(result.output);
    } else {
        core.setFailed(result.error);
    }
} catch (error) {
    core.setFailed(error.message);
}

async function publishToHippo(canary, specPath) {
    const ir = await installHippofactory();
    if (failed(ir)) {
        return ir;
    }

    const rr = await runHippofactory(canary, specPath);
    return rr;
}

async function installHippofactory() {
    const file = `hippofactory-v${HF_VERSION}-${os()}-amd64.tar.gz`;
    const url = `https://github.com/deislabs/hippofactory/releases/download/v${HF_VERSION}/${file}`;

    await mkdirp(HF_WORKING_DIR);
    await download(url, HF_WORKING_DIR);
    return untar(path.join(HF_WORKING_DIR, file), HF_WORKING_DIR);
}

async function runHippofactory(canary) {
    const file = path.join(HF_WORKING_DIR, `hippofactory${fileExt()}`);

    const v = canary ? "" : "-v production";
    const args = `${specPath} -o message ${v}`;

    const env = Object.assign({}, process.env);
    if (canary) {
        env['USER'] = 'canary';
    }

    const cmd = `${file} ${args}`;
    const opts = { async: true, env };

    const sr = await execCore(cmd, opts);

    if (sr.succeeded) {
        return { succeeded: true, output: sr.stdout };
    }

    return { succeeded: false, error: sr.stderr };
}

function os() {
    switch (process.platform) {
        case 'win32': return "windows";
        case 'darwin': return "macos";
        case 'linux': return "linux";
        default: throw new Error(`unknown platform '${process.platform}'`);
    }
}

function fileExt() {
    switch (process.platform) {
        case 'win32': return ".exe";
        default: return "";
    }
}

async function untar(sourceFile, destinationFolder) {
    try {
        await tar.x({
            cwd: destinationFolder,
            file: sourceFile
        });
        return { succeeded: true };
    } catch (e) {
        return { succeeded: false, error: "tar extract failed" };
    }
}

function execCore(cmd, opts) {
    return new Promise((resolve) => {
        const proc = shelljs.exec(cmd, opts, (code, stdout, stderr) => resolve({code : code, stdout : stdout, stderr : stderr}));
    });
}