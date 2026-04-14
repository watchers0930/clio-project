# CLIO 모달 스타일 가이드

> **최종 업데이트**: 2026-04-14  
> **기준 모달**: 파일 업로드 모달 (`/files`), 템플릿 모달 (`/templates`), STT 모달 (`SttModal`)  
> **주의**: Tailwind v4 환경에서 `space-y-*` 유틸리티가 CSS를 생성하지 않으므로, 섹션 간 간격은 반드시 `style={{ marginTop: 'Npx' }}` 인라인 스타일로 처리할 것

---

## 1. 오버레이 (Overlay)

```tsx
<div
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
  role="dialog"
  aria-modal="true"
  onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
  onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
>
```

| 속성 | 값 | 설명 |
|------|-----|------|
| `z-index` | `z-50` | 기본. ConfirmDialog는 `z-[70]`으로 올림 |
| 배경 | `bg-black/40 backdrop-blur-sm` | 40% 검정 + 블러 |
| 클릭 닫기 | `e.target === e.currentTarget` | 오버레이 클릭 시 닫기 |
| ESC 닫기 | `onKeyDown` | 항상 추가 |

---

## 2. 모달 컨테이너 (Container)

```tsx
<div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
```

| 속성 | 값 |
|------|-----|
| 배경 | `bg-white` |
| 테두리 반경 | `rounded-2xl` |
| 그림자 | `shadow-xl` |
| 너비 | `w-full max-w-lg mx-4` (기본) |
| 최대 높이 | `max-h-[85vh] overflow-y-auto` (스크롤 필요 시) |

**크기별 가이드**

| 크기 | 클래스 | 용도 |
|------|--------|------|
| Small | `max-w-sm` | 확인 다이얼로그 |
| Medium | `max-w-lg` | 일반 폼 모달 (기본) |
| Large | `max-w-2xl` | 복잡한 폼 / 미리보기 |

---

## 3. 헤더 (Header)

```tsx
<div className="px-8 py-6 border-b border-[#e5e5e7] flex items-center justify-between">
  <h2 className="text-lg font-semibold text-[#1d1d1f]">모달 제목</h2>
  <button
    onClick={onClose}
    className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] transition-colors"
  >
    <X size={18} />
  </button>
</div>
```

| 요소 | 클래스 |
|------|--------|
| 컨테이너 | `px-8 py-6 border-b border-[#e5e5e7] flex items-center justify-between` |
| 제목 | `text-lg font-semibold text-[#1d1d1f]` |
| 부제목 (선택) | `text-xs text-[#6e6e73] mt-0.5` |
| 닫기 버튼 | `p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] transition-colors` |
| 닫기 아이콘 크기 | `size={18}` |

---

## 4. 바디 (Body)

```tsx
<div className="px-8 py-6">
  {/* 섹션 1 */}
  <div>
    ...
  </div>

  {/* 섹션 2 — space-y-* 미작동으로 inline style 사용 */}
  <div style={{ marginTop: '24px' }}>
    ...
  </div>
</div>
```

> ⚠️ **Tailwind v4 주의**: `space-y-6` 클래스는 CSS를 생성하지 않음.  
> 섹션 간 간격은 두 번째 섹션부터 `style={{ marginTop: '24px' }}` 으로 고정.

| 속성 | 값 |
|------|-----|
| 패딩 | `px-8 py-6` |
| 섹션 간격 | `style={{ marginTop: '24px' }}` (= space-y-6 대체) |

---

## 5. 폼 섹션 구조 (Form Section)

각 섹션은 `<div>` 로 묶고, 내부 요소 간격은 인라인 스타일 사용:

```tsx
<div>
  {/* 레이블 */}
  <label
    className="block text-sm font-medium text-[#1d1d1f]"
    style={{ marginBottom: '5px' }}
  >
    섹션 레이블
  </label>

  {/* 입력 요소 (버튼 그룹 예시) */}
  <div className="flex gap-3" style={{ marginBottom: '10px' }}>
    ...
  </div>

  {/* 안내 텍스트 */}
  <p className="text-xs text-[#6e6e73]" style={{ padding: '10px 0' }}>
    안내 문구
  </p>
</div>
```

| 요소 | 클래스 / 스타일 |
|------|----------------|
| 레이블 | `text-sm font-medium text-[#1d1d1f]` + `marginBottom: '5px'` |
| 요소 하단 여백 | `marginBottom: '10px'` |
| 안내 텍스트 | `text-xs text-[#6e6e73]` + `padding: '10px 0'` |
| 에러 텍스트 | `text-xs text-red-500 mt-1` |

---

## 6. 텍스트 입력 (Text Input)

```tsx
<input
  type="text"
  className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] text-sm text-[#1d1d1f] placeholder-[#aaa] focus:outline-none focus:border-[#0071e3] transition-colors"
/>
```

| 상태 | 테두리 색 |
|------|----------|
| 기본 | `border-[#e5e5e7]` |
| 포커스 | `focus:border-[#0071e3]` |
| 에러 | `border-red-400` |

---

## 7. 토글 버튼 그룹 (Toggle Buttons)

선택/비선택 상태를 가진 2~N개 버튼:

```tsx
<div className="flex gap-3" style={{ marginBottom: '10px' }}>
  {/* 선택됨 — 다크 */}
  <button className="flex-1 py-3.5 rounded-xl border border-[#1d1d1f] bg-[#1d1d1f] text-white text-sm font-medium transition-colors">
    옵션 A
  </button>

  {/* 선택됨 — 블루 */}
  <button className="flex-1 py-3.5 rounded-xl border border-[#0071e3] bg-[#0071e3] text-white text-sm font-medium transition-colors">
    옵션 B
  </button>

  {/* 비선택 */}
  <button className="flex-1 py-3.5 rounded-xl border border-[#e5e5e7] text-[#6e6e73] text-sm font-medium hover:bg-[#f5f5f7] transition-colors">
    옵션 C
  </button>
</div>
```

| 상태 | 클래스 |
|------|--------|
| 활성 (다크) | `border-[#1d1d1f] bg-[#1d1d1f] text-white` |
| 활성 (블루) | `border-[#0071e3] bg-[#0071e3] text-white` |
| 비활성 | `border-[#e5e5e7] text-[#6e6e73] hover:bg-[#f5f5f7]` |
| 공통 | `flex-1 py-3.5 rounded-xl border text-sm font-medium transition-colors` |

---

## 8. 드롭존 (Dropzone)

파일 드래그&드롭 영역:

```tsx
<div
  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
  onDragLeave={() => setDragOver(false)}
  onDrop={handleDrop}
  style={{ marginTop: '24px' }}
  className={`border-2 border-dashed rounded-2xl py-8 px-6 flex flex-col items-center text-center transition-colors
    ${dragOver ? 'border-[#0071e3] bg-[#eef4ff]' : 'border-[#e5e5e7] bg-[#f5f5f7]'}`}
>
  {/* 아이콘 */}
  <svg className="w-10 h-10 text-[#6e6e73] mb-4" .../>

  {/* 안내 문구 */}
  <p className="text-sm font-medium text-[#1d1d1f] mb-1">파일을 여기에 끌어다 놓으세요</p>
  <p className="text-xs text-[#6e6e73] mb-4">또는</p>

  {/* 파일 선택 버튼 */}
  <button
    onClick={handleFilePicker}
    style={{ margin: '10px 0' }}
    className="px-5 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-[13px] font-medium hover:bg-[#0071e3] transition-colors"
  >
    파일 선택
  </button>

  {/* 지원 형식 */}
  <p className="text-xs text-[#6e6e73] mt-4">PDF, DOCX, PPTX, XLSX, HWP, MD (최대 50MB)</p>
</div>
```

| 상태 | 스타일 |
|------|--------|
| 기본 | `border-[#e5e5e7] bg-[#f5f5f7]` |
| 드래그 오버 | `border-[#0071e3] bg-[#eef4ff]` |
| 아이콘 크기 | `w-10 h-10` |
| 내부 버튼 여백 | `style={{ margin: '10px 0' }}` |

---

## 9. 액션 버튼 (Footer Buttons)

```tsx
<div className="px-8 py-5 border-t border-[#e5e5e7] flex justify-end gap-3">
  {/* 취소 */}
  <button className="px-6 py-3 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors">
    취소
  </button>

  {/* 확인 (Primary) */}
  <button className="px-6 py-3 rounded-xl bg-[#0071e3] text-white text-sm font-medium hover:bg-[#005bbf] transition-colors">
    확인
  </button>

  {/* 위험 (Danger) */}
  <button className="px-6 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#2d2d2f] transition-colors">
    삭제
  </button>
</div>
```

| 버튼 종류 | 클래스 |
|----------|--------|
| 취소 | `border border-[#e5e5e7] text-[#6e6e73] hover:bg-[#f5f5f7]` |
| Primary | `bg-[#0071e3] text-white hover:bg-[#005bbf]` |
| Danger | `bg-[#1d1d1f] text-white hover:bg-[#2d2d2f]` |
| 공통 | `px-6 py-3 rounded-xl text-sm font-medium transition-colors` |
| 푸터 컨테이너 | `px-8 py-5 border-t border-[#e5e5e7] flex justify-end gap-3` |

---

## 10. 전체 조합 예시

```tsx
{showModal && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">

      {/* 헤더 */}
      <div className="px-8 py-6 border-b border-[#e5e5e7] flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1d1d1f]">제목</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* 바디 */}
      <div className="px-8 py-6">

        {/* 섹션 1 */}
        <div>
          <label className="block text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: '5px' }}>
            레이블
          </label>
          <input
            className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] text-sm focus:outline-none focus:border-[#0071e3] transition-colors"
          />
        </div>

        {/* 섹션 2 */}
        <div style={{ marginTop: '24px' }}>
          <label className="block text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: '5px' }}>
            공개 범위
          </label>
          <div className="flex gap-3" style={{ marginBottom: '10px' }}>
            <button className="flex-1 py-3.5 rounded-xl border border-[#1d1d1f] bg-[#1d1d1f] text-white text-sm font-medium transition-colors">
              옵션 A
            </button>
            <button className="flex-1 py-3.5 rounded-xl border border-[#e5e5e7] text-[#6e6e73] text-sm font-medium hover:bg-[#f5f5f7] transition-colors">
              옵션 B
            </button>
          </div>
          <p className="text-xs text-[#6e6e73]" style={{ padding: '10px 0' }}>
            안내 문구
          </p>
        </div>

      </div>

      {/* 푸터 */}
      <div className="px-8 py-5 border-t border-[#e5e5e7] flex justify-end gap-3">
        <button onClick={onClose} className="px-6 py-3 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors">
          취소
        </button>
        <button className="px-6 py-3 rounded-xl bg-[#0071e3] text-white text-sm font-medium hover:bg-[#005bbf] transition-colors">
          확인
        </button>
      </div>

    </div>
  </div>
)}
```

---

## 11. 컬러 팔레트 요약

| 변수 | 값 | 용도 |
|------|----|------|
| `#1d1d1f` | 거의 검정 | 제목, 강조 버튼, 다크 액션 |
| `#6e6e73` | 중간 회색 | 보조 텍스트, 취소 버튼, 아이콘 |
| `#e5e5e7` | 연한 회색 | 구분선, 비활성 테두리 |
| `#f5f5f7` | 배경 회색 | hover 배경, 드롭존 기본 배경 |
| `#0071e3` | 파란색 | Primary 액션, 포커스 |
| `#005bbf` | 진한 파란색 | Primary 버튼 hover |
| `#eef4ff` | 연한 파란색 | 드롭존 드래그오버 배경 |

---

## 12. ⚠️ Tailwind v4 주의사항

| 문제 | 원인 | 해결 |
|------|------|------|
| `space-y-6` 미작동 | Tailwind v4에서 CSS 미생성 | `style={{ marginTop: 'Npx' }}` 인라인 스타일 |
| `mb-[10px]` 미작동 | Tailwind v4 arbitrary value 이슈 | `style={{ marginBottom: 'Npx' }}` |
| `gap-[24px]` | flex/grid에서는 `gap` 작동하는 경우 있음 | 불확실하면 인라인 스타일 사용 |
