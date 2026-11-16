// 열린 대화상자 순서 — 맨 위 창만 Escape·Tab 초점 가두기에 반응하게 한다(창이 겹칠 때 아래 창까지 닫히는 것 방지).

export function createDialogStack() {
  let seq = 0;
  const ids: number[] = [];
  return {
    push(): number {
      seq += 1;
      ids.push(seq);
      return seq;
    },
    remove(id: number): void {
      const i = ids.indexOf(id);
      if (i >= 0) ids.splice(i, 1);
    },
    isTop(id: number): boolean {
      return ids.length > 0 && ids[ids.length - 1] === id;
    },
    size(): number {
      return ids.length;
    },
  };
}

/** 앱 전체에서 공유하는 하나의 순서 */
export const dialogStack = createDialogStack();
