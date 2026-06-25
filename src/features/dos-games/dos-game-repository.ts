import {getDownloadURL, ref} from 'firebase/storage';
import {firebaseStorage} from '@/lib/firebase';

const doomRootStoragePath = 'media/public/games/dos-box/doom';

const doomRootFiles = [
  'DOOM-Info-Card.txt',
  'DOOM.BAT',
  'DOOMWEB.BAT',
] as const;

const doomGameFiles = [
  'DEFAULT.CFG',
  'DM.DOC',
  'DM.EXE',
  'DMFAQ66A.TXT',
  'DMFAQ66B.TXT',
  'DMFAQ66C.TXT',
  'DMFAQ66D.TXT',
  'DOOM.EXE',
  'DOOM1.WAD',
  'DOOMS_19.DAT',
  'DWANGO.DOC',
  'DWANGO.EXE',
  'DWANGO.STR',
  'HELPME.TXT',
  'IPXSETUP.EXE',
  'MODEM.CFG',
  'MODEM.NUM',
  'MODEM.STR',
  'ORDER.FRM',
  'README.TXT',
  'SERSETUP.EXE',
  'SETUP.EXE',
] as const;

export type DosGameFile = {
  bundlePath: string;
  downloadUrl: string;
};

async function resolveStorageFile(storagePath: string, bundlePath: string) {
  return {
    bundlePath,
    downloadUrl: await getDownloadURL(ref(firebaseStorage, storagePath)),
  };
}

export async function getDoomGameFiles(): Promise<DosGameFile[]> {
  const rootFiles = doomRootFiles.map(async (fileName) =>
    resolveStorageFile(`${doomRootStoragePath}/${fileName}`, fileName),
  );
  const gameFiles = doomGameFiles.map(async (fileName) =>
    resolveStorageFile(
      `${doomRootStoragePath}/DOOMS/${fileName}`,
      `DOOMS/${fileName}`,
    ),
  );

  return Promise.all([...rootFiles, ...gameFiles]);
}
