/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Music, 
  Volume2, 
  VolumeX, 
  Calendar, 
  MapPin, 
  Send, 
  Heart, 
  Camera,
  ChevronDown,
  CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { generateTuvanPoem } from './services/geminiService';

const TELEGRAM_BOT_TOKEN = '8728703978:AAEXpqV_XpBG7AGJzAKNH5XlysVgfqQcsvs';
const TELEGRAM_CHAT_ID = '5446101221';

// Atmospheric background music - using a royalty free ambient track
const AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'; 

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [poem, setPoem] = useState<string>('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchPoem = async () => {
      const generatedPoem = await generateTuvanPoem('Игорь', 40);
      setPoem(generatedPoem || '');
    };
    fetchPoem();
  }, []);

  const handleStart = () => {
    setShowContent(true);
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log("Audio play failed", e));
    }
  };

  const toggleMusic = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleRSVP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    const message = `🔔 Чалалганы бадыткаан:\n👤 Ады: ${name}\n🎂 Игорьнуң 40 хары`;

    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
        }),
      });
      
      setIsSubmitted(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#D4AF37', '#1A1A1A', '#FFFFFF']
      });
    } catch (error) {
      console.error('Error sending to Telegram:', error);
      alert('Алдаг болду. Дахин тыртып көрүңер.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden selection:bg-gold/30">
      <audio ref={audioRef} src={AUDIO_URL} loop />

      {/* Welcome Overlay */}
      <AnimatePresence>
        {!showContent && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#fdfbf7]"
          >
            <div className="text-center p-8">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8 }}
              >
                <h2 className="font-serif text-4xl mb-4 italic text-gold">Моорлап кириңер</h2>
                <p className="text-dark/60 mb-8 tracking-widest uppercase text-xs">Чалалганы ажыдар</p>
                <button 
                  onClick={handleStart}
                  className="px-8 py-3 bg-dark text-white rounded-full hover:bg-gold transition-colors duration-500 flex items-center gap-2 mx-auto group"
                >
                  Ажыдар
                  <ChevronDown className="w-4 h-4 group-hover:translate-y-1 transition-transform" />
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      {showContent && (
        <main className="relative">
          {/* Music Control */}
          <button 
            onClick={toggleMusic}
            className="fixed top-6 right-6 z-40 p-3 glass rounded-full hover:bg-white/40 transition-all"
          >
            {isPlaying ? <Volume2 className="w-5 h-5 text-gold" /> : <VolumeX className="w-5 h-5 text-dark/40" />}
          </button>

          {/* Hero Section */}
          <section className="h-screen flex flex-col items-center justify-center relative px-6">
            <div className="absolute inset-0 z-0">
              <img 
                src="https://images.unsplash.com/photo-1519074063912-ad25b57b984a?q=80&w=1920&auto=format&fit=crop" 
                alt="Background" 
                className="w-full h-full object-cover opacity-20"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#fdfbf7]/50 to-[#fdfbf7]" />
            </div>

            <motion.div 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="z-10 text-center max-w-2xl"
            >
              <span className="text-gold font-medium tracking-[0.3em] uppercase text-sm mb-6 block">Чалалга</span>
              <h1 className="font-serif text-6xl md:text-8xl mb-4 text-dark">Иргит Игорь</h1>
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="h-[1px] w-12 bg-gold/50" />
                <span className="font-serif italic text-3xl text-gold">40 хар</span>
                <div className="h-[1px] w-12 bg-gold/50" />
              </div>
              
              <div className="mt-12 space-y-4">
                <div className="flex items-center justify-center gap-2 text-dark/70">
                  <Calendar className="w-4 h-4 text-gold" />
                  <span className="tracking-wide">2026 чылдың Март 15</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-dark/70">
                  <MapPin className="w-4 h-4 text-gold" />
                  <span className="tracking-wide">Кызыл хоорай, "Тыва" ресторан</span>
                </div>
              </div>
            </motion.div>

            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 opacity-30"
            >
              <ChevronDown className="w-6 h-6" />
            </motion.div>
          </section>

          {/* Poem Section */}
          <section className="py-24 px-6 bg-white/30">
            <div className="max-w-xl mx-auto text-center">
              <Heart className="w-8 h-8 text-gold/30 mx-auto mb-8" />
              <motion.div 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="font-serif text-xl md:text-2xl leading-relaxed italic text-dark/80 whitespace-pre-line"
              >
                {poem || "Төрээн хүнүң таварыштыр\nИзүү байыр чедирип тур мен!\nАас-кежик, кадыкшылды\nАрат-чонга күзээр-дир мен."}
              </motion.div>
            </div>
          </section>

          {/* Gallery Section */}
          <section className="py-24 px-6">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-4 mb-12">
                <Camera className="w-5 h-5 text-gold" />
                <h2 className="font-serif text-3xl">Салгалдарның сактыышкыны</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div 
                  whileHover={{ y: -10 }}
                  className="aspect-[3/4] overflow-hidden rounded-2xl shadow-xl"
                >
                  <img 
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800&auto=format&fit=crop" 
                    className="w-full h-full object-cover"
                    alt="Portrait 1"
                    referrerPolicy="no-referrer"
                  />
                </motion.div>
                <motion.div 
                  whileHover={{ y: -10 }}
                  className="aspect-[3/4] overflow-hidden rounded-2xl shadow-xl md:translate-y-12"
                >
                  <img 
                    src="https://images.unsplash.com/photo-1480429370139-e0132c086e2a?q=80&w=800&auto=format&fit=crop" 
                    className="w-full h-full object-cover"
                    alt="Portrait 2"
                    referrerPolicy="no-referrer"
                  />
                </motion.div>
                <motion.div 
                  whileHover={{ y: -10 }}
                  className="aspect-[3/4] overflow-hidden rounded-2xl shadow-xl"
                >
                  <img 
                    src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=800&auto=format&fit=crop" 
                    className="w-full h-full object-cover"
                    alt="Portrait 3"
                    referrerPolicy="no-referrer"
                  />
                </motion.div>
              </div>
            </div>
          </section>

          {/* RSVP Section */}
          <section className="py-32 px-6 bg-dark text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              <div className="absolute top-[-10%] right-[-10%] w-96 h-96 rounded-full bg-gold blur-[120px]" />
              <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 rounded-full bg-gold blur-[120px]" />
            </div>

            <div className="max-w-lg mx-auto relative z-10 text-center">
              {!isSubmitted ? (
                <>
                  <h2 className="font-serif text-4xl mb-4">Чалалганы бадыткаар</h2>
                  <p className="text-white/60 mb-12">Бистиң байырлалывыска кээриңерни манап турар бис</p>
                  
                  <form onSubmit={handleRSVP} className="space-y-6">
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Силерниң ады-шолаңар"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 focus:outline-none focus:border-gold transition-colors text-lg"
                        required
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gold hover:bg-gold/80 text-dark font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Чорудуп турар...' : (
                        <>
                          Бадыткаар
                          <Send className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="py-12"
                >
                  <CheckCircle2 className="w-20 h-20 text-gold mx-auto mb-6" />
                  <h2 className="font-serif text-4xl mb-4">Четтирдивис!</h2>
                  <p className="text-white/60">Силерниң харыыңарны Игорь хүлээн алды. Байырлалга чедир!</p>
                </motion.div>
              )}
            </div>
          </section>

          {/* Footer */}
          <footer className="py-12 text-center text-dark/30 text-xs tracking-widest uppercase">
            <p>© 2026 Иргит Игорь - 40 хар</p>
          </footer>
        </main>
      )}
    </div>
  );
}
