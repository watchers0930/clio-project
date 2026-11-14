// 출력 포맷(xlsx/pptx/docx/hwpx/pdf)별 AI 생성 분기 — 포맷에 맞는 생성 함수를 골라 GenerationResult로 반환
import type { GenerationResult, OutputFormat } from '@/lib/renderers/types';
import type { TemplateBundle } from '@/lib/templates/template-schema';
import { generateDocumentContent } from './generate-document';
import { generateDocxTemplateResult, generateHwpxTemplateResult } from './generate-document-helpers';
import {
  generateExcelCellData,
  generateExcelContent,
  generatePptxContent,
  generatePptxReplacements,
} from './generate-office-content';

export async function generateForFormat(params: {
  format: OutputFormat;
  templateName: string;
  templateContent?: string | null;
  templateBundle?: TemplateBundle | null;
  templateFileText?: string | null;
  templateBuffer?: Buffer | null;
  sourceChunks: string[];
  instructions?: string;
  documentInputs?: Record<string, string>;
  referenceSections?: Map<string, string>;
}): Promise<GenerationResult> {
  const { format, templateName, ...rest } = params;
  const title = templateName;
  const hasTemplateFile = !!rest.templateFileText && !!rest.templateBuffer;

  switch (format) {
    case 'xlsx':
      if (hasTemplateFile) {
        const excelCellData = await generateExcelCellData({
          templateName,
          templateFileText: rest.templateFileText!,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
        });
        return { format, title, excelCellData, templateBuffer: rest.templateBuffer! };
      }
      return {
        format,
        title,
        excelSheets: await generateExcelContent({
          templateName,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
        }),
      };

    case 'pptx':
      if (hasTemplateFile) {
        const pptxReplacements = await generatePptxReplacements({
          templateName,
          templateFileText: rest.templateFileText!,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
        });
        return { format, title, pptxReplacements, templateBuffer: rest.templateBuffer! };
      }
      return {
        format,
        title,
        pptxSlides: await generatePptxContent({
          templateName,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
        }),
      };

    case 'docx':
      if (hasTemplateFile) {
        const result = await generateDocxTemplateResult({
          format,
          title,
          templateName,
          templateBuffer: rest.templateBuffer!,
          templateFileText: rest.templateFileText!,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
          templateBundle: rest.templateBundle,
          documentInputs: rest.documentInputs,
        });
        if (!result.markdown) {
          result.markdown = await generateDocumentContent({
            templateName,
            templateContent: rest.templateContent,
            templateBundle: rest.templateBundle,
            templateFileText: rest.templateFileText,
            sourceChunks: rest.sourceChunks,
            instructions: rest.instructions,
            documentInputs: rest.documentInputs,
            referenceSections: rest.referenceSections,
          });
        }
        result.templateBundle = rest.templateBundle;
        result.documentInputs = rest.documentInputs;
        return result;
      }
      return {
        format,
        title,
        markdown: await generateDocumentContent({
          templateName,
          templateContent: rest.templateContent,
          templateBundle: rest.templateBundle,
          templateFileText: rest.templateFileText,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
          documentInputs: rest.documentInputs,
          referenceSections: rest.referenceSections,
        }),
        templateBundle: rest.templateBundle,
        documentInputs: rest.documentInputs,
      };

    case 'hwpx':
      if (hasTemplateFile) {
        const hwpxResult = await generateHwpxTemplateResult({
          format,
          title,
          templateName,
          templateBuffer: rest.templateBuffer!,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
        });
        if (hwpxResult) {
          if (!hwpxResult.markdown) {
            hwpxResult.markdown = await generateDocumentContent({
              templateName,
              templateContent: rest.templateContent,
              templateBundle: rest.templateBundle,
              templateFileText: rest.templateFileText,
              sourceChunks: rest.sourceChunks,
              instructions: rest.instructions,
              documentInputs: rest.documentInputs,
              referenceSections: rest.referenceSections,
            });
          }
          hwpxResult.templateBundle = rest.templateBundle;
          hwpxResult.documentInputs = rest.documentInputs;
          return hwpxResult;
        }
      }
      return {
        format,
        title,
        markdown: await generateDocumentContent({
          templateName,
          templateContent: rest.templateContent,
          templateBundle: rest.templateBundle,
          templateFileText: rest.templateFileText,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
          documentInputs: rest.documentInputs,
          referenceSections: rest.referenceSections,
        }),
        templateBundle: rest.templateBundle,
        documentInputs: rest.documentInputs,
      };

    case 'pdf':
      return {
        format,
        title,
        markdown: await generateDocumentContent({
          templateName,
          templateContent: rest.templateContent,
          templateBundle: rest.templateBundle,
          templateFileText: rest.templateFileText,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
          documentInputs: rest.documentInputs,
          referenceSections: rest.referenceSections,
        }),
        templateBundle: rest.templateBundle,
        documentInputs: rest.documentInputs,
      };

    default:
      throw new Error(`지원하지 않는 출력 포맷: ${format}`);
  }
}
