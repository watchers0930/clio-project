/** 문서 본문에 임베드된 입력값 메타 주석(<!--DOCUMENT_INPUTS:...-->)을 제거한다. */
function stripDocumentInputs(content: string): string {
  return content.replace(/^<!--(?:PROPOSAL_INPUTS|DOCUMENT_INPUTS):.*?-->\n?/, '');
}

/** 마크다운 본문을 읽기용으로 렌더한다(주석 메타는 제거). 편집 불가한 결과 표시 전용. */
export function DocumentMarkdownBody({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none">
      {stripDocumentInputs(content || '문서 내용이 없습니다.').split('\n').map((line, i) => {
        if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-foreground mt-4 mb-2">{line.replace('## ', '')}</h2>;
        if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-foreground mt-4 mb-2">{line.replace('# ', '')}</h1>;
        if (line.startsWith('- ')) return <li key={i} className="text-sm text-foreground ml-4">{line.replace('- ', '')}</li>;
        if (line.startsWith('*')) return <p key={i} className="text-sm text-foreground-secondary italic">{line.replace(/\*/g, '')}</p>;
        if (line.trim() === '---') return <hr key={i} className="my-3 border-border" />;
        if (line.trim() === '') return <br key={i} />;
        return <p key={i} className="text-sm text-foreground leading-relaxed">{line}</p>;
      })}
    </div>
  );
}
