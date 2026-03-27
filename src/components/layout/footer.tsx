export function Footer() {
  return (
    <footer className="bg-black">
      <div className="max-w-6xl mx-auto px-10 py-10">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6">
          {/* 왼쪽: 회사 정보 */}
          <div>
            <p className="text-lg font-semibold text-white tracking-wordmark mb-3">
              CLIO
            </p>
            <p className="text-sm text-white/60 leading-7">
              AI 문서관리 시스템
              <br /><br />
              대표이사 김동의
              <br />
              사업자등록번호 263-87-03481
              <br />
              통신판매신고번호 2025-경기광명-0189
              <br />
              서울특별시 강남구 영동대로85길 34, 901호
              <br />
              (스파크플러스 삼성2호점)
            </p>
          </div>

          {/* 오른쪽: 서비스 + 회사 + 고객센터 */}
          <div className="flex gap-12">
            {/* 서비스 */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">서비스</h4>
              <div className="flex flex-col gap-2">
                <span className="text-sm text-white/60 hover:text-white cursor-pointer">AI 검색</span>
                <span className="text-sm text-white/60 hover:text-white cursor-pointer">파일 관리</span>
                <span className="text-sm text-white/60 hover:text-white cursor-pointer">문서 생성</span>
                <span className="text-sm text-white/60 hover:text-white cursor-pointer">템플릿 관리</span>
                <span className="text-sm text-white/60 hover:text-white cursor-pointer">메시지</span>
              </div>
            </div>

            {/* 회사 */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">회사</h4>
              <div className="flex flex-col gap-2">
                <span className="text-sm text-white/60 hover:text-white cursor-pointer">회사소개</span>
                <span className="text-sm text-white/60 hover:text-white cursor-pointer">주요실적</span>
                <span className="text-sm text-white/60 hover:text-white cursor-pointer">문의하기</span>
              </div>
            </div>

            {/* 고객센터 */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">고객센터</h4>
              <p className="text-base font-bold text-white mb-1">010-8490-9271</p>
              <p className="text-sm text-white/60">평일 09:00 ~ 18:00</p>
              <p className="text-sm text-white/60 mt-3">bmicns@gmail.com</p>
            </div>
          </div>
        </div>
      </div>

      {/* 하단 카피라이트 */}
      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-10 py-4">
          <p className="text-xs text-white/40">
            Copyright &copy; 2026 BMI C&amp;S Co., Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
