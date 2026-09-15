import fs from 'fs';

import { generateCode } from '@ton-community/tlb-codegen';
import { beginCell, Cell, Dictionary, DictionaryValue } from '@ton/ton';

const TON_BLOCKCHAIN_VERSION = 'v2026.08';

const CellRef: DictionaryValue<Cell> = {
    serialize: (src, builder) => {
        builder.storeRef(src);
    },
    parse: (src) => src.loadRef(),
};

function makeSlim(config: Cell): Cell {
    const configDict = Dictionary.loadDirect(Dictionary.Keys.Int(32), CellRef, config);

    const configDictSlim = Dictionary.empty(Dictionary.Keys.Int(32), CellRef);

    for (let k = 0; k < 32; k++) {
        const prev = configDict.get(k);
        if (prev !== undefined) {
            configDictSlim.set(k, prev);
        }
    }

    return beginCell().storeDictDirect(configDictSlim).endCell();
}

function writeConfig(name: string, config: Cell, seqno: number) {
    const out = `export const ${name}ConfigSeqno = ${seqno};\nexport const ${name}Config = \`${config.toBoc({ idx: false }).toString('base64')}\`;`;

    fs.writeFileSync(`./src/config/${name}Config.ts`, out);
}

async function updateConfigSchema() {
    const tlbResponse = await fetch(
        `https://raw.githubusercontent.com/ton-blockchain/ton/${TON_BLOCKCHAIN_VERSION}/crypto/block/block.tlb`,
    );
    if (!tlbResponse.ok) {
        throw new Error(`Failed to fetch TL-B schema with status ${tlbResponse.status}`);
    }

    const tlb = await tlbResponse.text();
    const generated = generateCode(tlb, 'typescript');

    fs.writeFileSync('./src/config/config.tlb', tlb);
    fs.writeFileSync('./src/config/config.tlb-gen.ts', generated);
}

async function updateConfig() {
    const masterchainResponse = await fetch('https://toncenter.com/api/v2/getMasterchainInfo');
    const masterchainInfo = (await masterchainResponse.json()) as {
        ok: boolean;
        result: { last: { seqno: number } };
        error?: string;
    };
    if (!masterchainResponse.ok || !masterchainInfo.ok) {
        throw new Error(masterchainInfo.error ?? `TON Center request failed with status ${masterchainResponse.status}`);
    }

    const seqno = masterchainInfo.result.last.seqno;
    const configResponse = await fetch(`https://toncenter.com/api/v2/getConfigAll?seqno=${seqno}`);
    const configInfo = (await configResponse.json()) as {
        ok: boolean;
        result: { config: { bytes: string } };
        error?: string;
    };
    if (!configResponse.ok || !configInfo.ok) {
        throw new Error(configInfo.error ?? `TON Center request failed with status ${configResponse.status}`);
    }

    const config = Cell.fromBase64(configInfo.result.config.bytes);

    writeConfig('default', config, seqno);
    writeConfig('slim', makeSlim(config), seqno);
}

const main = async () => {
    await updateConfigSchema();
    await updateConfig();
};

main();
