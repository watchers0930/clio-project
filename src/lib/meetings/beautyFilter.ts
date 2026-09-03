/**
 * 무료 DIY 소프트 스무딩(뷰티) 필터.
 * 카메라 영상을 canvas에서 가공(원본 + 블러·밝기 오버레이 크로스페이드)해
 * 피부를 은은하게 매끄럽게 만든 MediaStreamTrack 을 반환한다. (ML 미사용, 경량)
 */
export interface BeautyProcessor {
  track: MediaStreamTrack;
  stop: () => void;
}

export async function startBeautyProcessor(): Promise<BeautyProcessor> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });

  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();

  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 720;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('canvas 컨텍스트를 만들 수 없습니다');
  }

  let raf = 0;
  const draw = () => {
    // 1) 원본
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.drawImage(video, 0, 0, w, h);
    // 2) 블러+밝기 버전을 낮은 불투명도로 덧입혀 피부 스무딩(소프트 글로우)
    ctx.filter = 'blur(5px) brightness(1.05) saturate(1.03)';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(video, 0, 0, w, h);
    // 리셋
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(draw);
  };
  draw();

  const outStream = canvas.captureStream(30);
  const track = outStream.getVideoTracks()[0];

  const stop = () => {
    cancelAnimationFrame(raf);
    track.stop();
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };

  return { track, stop };
}
