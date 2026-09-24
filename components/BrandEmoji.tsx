'use client';

import { useEffect, useState } from 'react';

const BRAND_EMOJIS = [
  '😀','😃','😄','😁','😆','😅','😂','🙂','🙃','😉',
  '😊','😎','🤓','🧐','🤩','🥳','😺','👻','🤖','👾',
  '🐱','🐶','🦊','🐼','🐨','🐸','🐵','🦁','🐯','🐧',
  '🦄','🐝','🦋','🐙','🦖','🐳','🦜','🐢','🦦','🐲',
  '🍎','🍉','🍓','🍒','🍍','🥝','🍋','🥑','🍕','🍔',
  '🍟','🍩','🍪','🍫','☕','🧋','🍿','🎂','🍯','🥨',
  '⚽','🏀','🎾','🎸','🎮','🎲','🧩','🎯','🚀','✈️',
  '🚗','🚲','🛸','🌍','🌙','☀️','⭐','🌈','⚡','🔥',
  '💧','❄️','🌊','🌸','🌻','🍀','🌵','🌴','💎','🎁',
  '🎉','🎵','💡','🧠','❤️','💜','💙','💚','🧡','✨',
] as const;


export function BrandEmoji() {
  const [emoji, setEmoji] = useState<string>('✨');
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setInterval> | undefined;
    const pick = () => setEmoji(current => {
      const index = BRAND_EMOJIS.indexOf(current as typeof BRAND_EMOJIS[number]);
      const offset = 1 + Math.floor(Math.random() * (BRAND_EMOJIS.length - 1));
      return BRAND_EMOJIS[(Math.max(index, 0) + offset) % BRAND_EMOJIS.length];
    });
    const update = () => {
      clearInterval(timer);
      if (!media.matches) timer = setInterval(pick, 1400);
    };
    const frame = requestAnimationFrame(pick);
    update();
    media.addEventListener('change', update);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
      media.removeEventListener('change', update);
    };
  }, []);
  return <span key={emoji} className="workspace-brand-emoji" aria-hidden="true">{emoji}</span>;
}
