// The one process that holds AZURE_SPEECH_KEY: synthesizes one SSML file into a wav with the Azure SDK and prints the
// word boundaries as JSON. It imports nothing from the video module but the Boundary type, so no agent-written
// component is ever loaded beside the key; it loads .env itself (the parent runs without the key and must not hand
// it over). Started per sentence by azure.ts (`npm run tts-azure -- <ssml file> <out wav>`), never by hand.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import sdk from 'microsoft-cognitiveservices-speech-sdk';
import { loadDotEnv } from '../../../shared/io';
import type { Boundary, Speak } from './azure';

export const sdkSpeak: Speak = (ssml, outFile, onBoundary) => {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region)
    throw new Error('azure TTS needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (.env or the environment)');
  const cfg = sdk.SpeechConfig.fromSubscription(key, region);
  cfg.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;
  cfg.setProperty(sdk.PropertyId.SpeechServiceResponse_RequestWordBoundary, 'true');
  const synth = new sdk.SpeechSynthesizer(cfg, null as unknown as undefined); // null: no speaker, the bytes come back in the result
  synth.wordBoundary = (_, e) =>
    onBoundary({ text: e.text, offset: e.audioOffset, duration: e.duration, type: String(e.boundaryType) });
  return new Promise<void>((resolve, reject) => {
    synth.speakSsmlAsync(
      ssml,
      (r) => {
        synth.close();
        if (r.reason !== sdk.ResultReason.SynthesizingAudioCompleted)
          return reject(new Error(`azure speech failed: ${r.errorDetails ?? sdk.ResultReason[r.reason]}`));
        writeFileSync(outFile, Buffer.from(r.audioData));
        resolve();
      },
      (e) => {
        synth.close();
        reject(new Error(`azure speech failed: ${e}`));
      },
    );
  });
};

/** `argv`: the SSML file and the wav to write. Prints `{ boundaries }` through `out`. */
export async function runWorker(
  argv: string[],
  speak: Speak = sdkSpeak,
  out: (s: string) => void = (s) => process.stdout.write(s),
): Promise<void> {
  const [ssmlFile, outFile] = argv;
  if (!ssmlFile || !outFile) throw new Error('usage: tts-azure <ssml file> <out wav>');
  const boundaries: Boundary[] = [];
  await speak(readFileSync(ssmlFile, 'utf8'), outFile, (b) => boundaries.push(b));
  out(JSON.stringify({ boundaries }) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadDotEnv();
  runWorker(process.argv.slice(2)).catch((e: Error) => {
    console.error(e.message);
    process.exit(1);
  });
}
