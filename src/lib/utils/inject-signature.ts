/**
 * 서명 이미지 주입 유틸리티
 * DOCX/HWPX 파일 버퍼에 서명 이미지를 삽입하여 반환
 */

import PizZip from 'pizzip';

// EMU 단위 (English Metric Units): 1cm = 360000, 1pt = 12700
const SIG_WIDTH_EMU = 1080000;  // 3cm
const SIG_HEIGHT_EMU = 540000;  // 1.5cm

/** DOCX에 서명 이미지 삽입 */
export function injectSignatureDocx(docxBuffer: Buffer, sigBuffer: Buffer): Buffer {
  try {
    const zip = new PizZip(docxBuffer);

    // 1. 서명 이미지를 word/media/signature.png로 추가
    zip.file('word/media/signature.png', sigBuffer);

    // 1-1. DOCX 패키지에 PNG content type 등록
    const contentTypesPath = '[Content_Types].xml';
    const contentTypesXml = zip.file(contentTypesPath)?.asText() ?? '';
    if (contentTypesXml && !/Extension="png"\s+ContentType="image\/png"/.test(contentTypesXml)) {
      const pngDefault = '<Default Extension="png" ContentType="image/png"/>';
      const updatedContentTypes = contentTypesXml.replace('</Types>', `  ${pngDefault}\n</Types>`);
      zip.file(contentTypesPath, updatedContentTypes);
    }

    // 2. 관계 파일에 이미지 관계 추가
    const relsPath = 'word/_rels/document.xml.rels';
    const relsXml = zip.file(relsPath)?.asText() ?? '';
    const sigRelId = 'rIdSignatureClio';
    if (!relsXml.includes(sigRelId)) {
      const rel = `<Relationship Id="${sigRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/signature.png"/>`;
      const updatedRels = relsXml.replace('</Relationships>', `  ${rel}\n</Relationships>`);
      zip.file(relsPath, updatedRels);
    }

    // 3. 서명 드로잉 XML
    const drawingXml = `<w:r xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${SIG_WIDTH_EMU}" cy="${SIG_HEIGHT_EMU}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="9001" name="clio_signature"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="clio_signature"/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="${sigRelId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SIG_WIDTH_EMU}" cy="${SIG_HEIGHT_EMU}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;

    // 4. document.xml에서 "(서명)" 또는 "(인)" 텍스트 찾아 교체
    let docXml = zip.file('word/document.xml')?.asText() ?? '';
    const markers = ['(서명)', '(인)'];
    let injected = false;

    for (const marker of markers) {
      if (docXml.includes(marker)) {
        // <w:t> 내 첫 번째 서명 마커만 교체한다. MOU처럼 양 당사자 서명란이
        // 함께 있는 문서는 작성자(갑) 위치에만 도장을 넣어야 한다.
        docXml = docXml.replace(
          new RegExp(`(<w:t[^>]*>)[^<]*(${marker.replace(/[()]/g, '\\$&')})[^<]*(</w:t>)`),
          (_, open, _m, close) => `${open}${close}${drawingXml}`
        );
        injected = true;
        break;
      }
    }

    // 5. 마커 없으면 </w:body> 직전에 서명 단락 추가
    if (!injected) {
      const sigPara = `<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:pPr><w:jc w:val="right"/></w:pPr>${drawingXml}</w:p>`;
      docXml = docXml.replace('</w:body>', `${sigPara}</w:body>`);
    }

    zip.file('word/document.xml', docXml);

    return Buffer.from(
      zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
    );
  } catch (err) {
    console.error('[injectSignatureDocx]', err);
    return docxBuffer; // 실패 시 원본 반환
  }
}

/** HWPX에 서명 이미지 삽입 */
export function injectSignatureHwpx(hwpxBuffer: Buffer, sigBuffer: Buffer, userName: string): Buffer {
  try {
    const zip = new PizZip(hwpxBuffer);

    // 1. BinData 폴더에 서명 이미지 추가
    const binPath = 'BinData/signature_clio.png';
    zip.file(binPath, sigBuffer);

    // 2. content.hpf에 BinData 항목 등록
    const hpfPath = 'Contents/content.hpf';
    let hpfXml = zip.file(hpfPath)?.asText() ?? '';
    const binId = 'BIN00SIG';
    if (hpfXml && !hpfXml.includes(binId)) {
      const binEntry = `<hpf:BinData Id="${binId}" Type="embed" Format="png" OriginalFormat="png" BinDataPath="BinData/signature_clio.png"/>`;
      // BinDataList 내에 추가 시도
      if (hpfXml.includes('<hpf:BinDataList')) {
        hpfXml = hpfXml.replace(/<hpf:BinDataList([^>]*)>/, `<hpf:BinDataList$1>\n  ${binEntry}`);
      } else if (hpfXml.includes('</hpf:Head>')) {
        hpfXml = hpfXml.replace('</hpf:Head>', `<hpf:BinDataList count="1">\n  ${binEntry}\n</hpf:BinDataList>\n</hpf:Head>`);
      }
      zip.file(hpfPath, hpfXml);
    }

    // 3. section0.xml에서 서명 마커 찾아 이미지 단락으로 교체
    const secPath = 'Contents/section0.xml';
    let secXml = zip.file(secPath)?.asText() ?? '';
    const markers = ['(서명)', '(인)'];

    // HWPX 이미지 단락 XML
    const imgPara = `<hp:p xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"><hp:run><hp:picture><hp:img binaryItemIDRef="${binId}" width="3000000" height="1500000" /></hp:picture></hp:run></hp:p>`;

    let injected = false;
    for (const marker of markers) {
      if (secXml.includes(marker)) {
        // <hp:t> 텍스트 중 마커 포함된 단락 전체를 이미지 단락으로 교체
        secXml = secXml.replace(
          new RegExp(`<hp:p>[^<]*(?:<[^>]+>[^<]*)*${marker.replace(/[()]/g, '\\$&')}(?:[^<]*<[^>]+>)*[^<]*</hp:p>`),
          imgPara
        );
        injected = true;
        break;
      }
    }

    // 마커 없으면 </hp:subList> 직전에 서명 단락 추가 (이름 텍스트로 폴백)
    if (!injected) {
      const safeUserName = userName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const namePara = `<hp:p xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"><hp:pPr><hp:jc val="right"/></hp:pPr><hp:run><hp:char><hp:t>${safeUserName} (서명)</hp:t></hp:char></hp:run></hp:p>`;
      secXml = secXml.replace('</hp:subList>', `${namePara}</hp:subList>`);
    }

    zip.file(secPath, secXml);

    // HWPX: mimetype은 STORE, 나머지 DEFLATE
    const files = zip.files;
    const result = new PizZip();
    for (const [name, file] of Object.entries(files)) {
      const content = file.asNodeBuffer?.() ?? Buffer.from(file.asArrayBuffer());
      result.file(name, content, { compression: name === 'mimetype' ? 'STORE' : 'DEFLATE' });
    }

    return Buffer.from(result.generate({ type: 'nodebuffer' }));
  } catch (err) {
    console.error('[injectSignatureHwpx]', err);
    return hwpxBuffer; // 실패 시 원본 반환
  }
}
