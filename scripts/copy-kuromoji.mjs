// 후리가나용 일본어 형태소 분석기(kuromoji)와 사전을 public 폴더로 복사합니다.
// 호스팅 서버가 .gz 파일을 자동으로 풀어서 보내는 경우에도 동작하도록 작은 패치를 넣습니다.
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const src = "node_modules/kuromoji";
if (!existsSync(src)) process.exit(0);
mkdirSync("public/kuromoji", { recursive: true });
cpSync(`${src}/dict`, "public/kuromoji/dict", { recursive: true });

const before = "var gz = new zlib.Zlib.Gunzip(new Uint8Array(arraybuffer));\n        var typed_array = gz.decompress();";
const after = "var bytes = new Uint8Array(arraybuffer);\n        var typed_array = (bytes[0] === 0x1f && bytes[1] === 0x8b) ? new zlib.Zlib.Gunzip(bytes).decompress() : bytes;";
let js = readFileSync(`${src}/build/kuromoji.js`, "utf8");
if (js.includes(before)) js = js.replace(before, after);
writeFileSync("public/kuromoji/kuromoji.js", js);
console.log("kuromoji 사전 복사 완료");
