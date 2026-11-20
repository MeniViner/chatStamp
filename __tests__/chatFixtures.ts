import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

type ExpectedAttachment = {
  sender: string;
  dateSource: 'chat' | 'filename' | 'zip-entry' | 'none';
  date: string | null;
  saveDate?: string;
};

type FixtureEntry = {
  path: string;
  modificationTime?: string;
} & ({ expected: ExpectedAttachment; skip?: never } | { skip: 'unsupported'; expected?: never });

type FixtureInventory = {
  zone: string;
  order: 'dmy' | 'mdy' | 'ymd';
  entries: FixtureEntry[];
  captions?: string[];
};

const root = fileURLToPath(new URL('./fixtures/chats/', import.meta.url));

function loadFixtures(folder: string, group: string) {
  const names = new Set<string>();
  for (const file of readdirSync(folder)) {
    const suffix = ['.txt', '.files.json'].find((candidate) => file.endsWith(candidate));
    if (suffix) names.add(file.slice(0, -suffix.length));
  }
  return [...names].sort().map((name) => {
    const transcriptPath = join(folder, `${name}.txt`);
    const inventoryPath = join(folder, `${name}.files.json`);
    if (!existsSync(transcriptPath) || !existsSync(inventoryPath)) {
      throw new Error(`Missing transcript or inventory for ${group}${name}`);
    }
    const text = readFileSync(transcriptPath, 'utf8');
    const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as FixtureInventory;
    return { name: `${group}${name}`, text, ...inventory };
  });
}

export const chatFixtures = [...loadFixtures(root, ''), ...loadFixtures(join(root, 'real'), 'real/')];
