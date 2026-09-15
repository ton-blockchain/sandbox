import fs from 'fs';

import { beginCell, Cell, Dictionary, DictionaryValue } from '@ton/ton';

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

async function getLatestConfig() {
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

    return { config: Cell.fromBase64(configInfo.result.config.bytes), seqno };
}

const main = async () => {
    const { config, seqno } = await getLatestConfig();

    writeConfig('default', config, seqno);

    writeConfig('slim', makeSlim(config), seqno);
};

main();
