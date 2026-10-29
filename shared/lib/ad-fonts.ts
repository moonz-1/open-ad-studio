/** Licensed OFL font files for Resvg PNG export (Node). Browser SVG uses CSS family names. */
import {existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const fontDir=join(here,'..','fonts');

const FILES=[
 'EBGaramond-Regular.ttf',
 'Newsreader-Regular.ttf',
 'SourceSans3-Regular.ttf',
 'SourceSans3-Semibold.ttf',
 'DMSans-Medium.ttf',
 'Outfit-SemiBold.ttf',
] as const;

/** Absolute paths to bundled OFL fonts that exist on disk. */
export function adFontFiles():string[]{
 return FILES.map(f=>join(fontDir,f)).filter(p=>existsSync(p));
}

export function adFontDir(){return fontDir;}

/** Resvg-friendly load options: prefer bundled OFL faces, fall back to system fonts. */
export function resvgFontOptions(){
 const fontFiles=adFontFiles();
 return {
  loadSystemFonts:true as const,
  defaultFontFamily:fontFiles.length?'EB Garamond':'Georgia',
  ...(fontFiles.length?{fontFiles}:{}),
 };
}
