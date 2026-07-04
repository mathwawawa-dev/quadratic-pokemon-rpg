/*
    [나중에 쓸 수 있도록 보관하는 Launch Point 시각화 코드 스니펫]
    이 코드는 플레이어 주변 원형 반경(0.7) 중 발사가 가능한 영역(|x| <= 0.3)의 
    상/하단 테두리(Arc)를 진하게 하이라이트 해주는 렌더링 코드입니다.

    적용 위치: engine.js 의 render() 함수 내 'Player radius' 그리는 부분 직후
*/

    // Launch Point active arcs (|x - player.x| <= 0.3) - 뚜렷하고 강렬하게 테두리 표시
    ctx.save();
    const alpha = Math.asin(0.3 / 0.7);
    ctx.strokeStyle = getMissileColor();
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    
    // Top Active Arc
    ctx.beginPath();
    ctx.arc(pCenter.x, pCenter.y, pRad, -Math.PI/2 - alpha, -Math.PI/2 + alpha);
    ctx.stroke();

    // Bottom Active Arc
    ctx.beginPath();
    ctx.arc(pCenter.x, pCenter.y, pRad, Math.PI/2 - alpha, Math.PI/2 + alpha);
    ctx.stroke();

    // 얇은 흰색 코어 라인을 덧그려서 가시성 극대화 (어느 배경에서나 보임)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(pCenter.x, pCenter.y, pRad, -Math.PI/2 - alpha, -Math.PI/2 + alpha);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pCenter.x, pCenter.y, pRad, Math.PI/2 - alpha, Math.PI/2 + alpha);
    ctx.stroke();
    ctx.restore();
