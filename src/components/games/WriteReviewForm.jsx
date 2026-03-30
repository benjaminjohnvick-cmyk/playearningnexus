import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, Send, Mic, MicOff, Gamepad2, Image as ImageIcon, Zap, DollarSign, Smile } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_LABELS = [
  { key: 'gameplay',    label: 'Gameplay',    icon: Gamepad2  },
  { key: 'graphics',   label: 'Graphics',    icon: ImageIcon },
  { key: 'performance',label: 'Performance', icon: Zap       },
  { key: 'fun_factor', label: 'Fun Factor',  icon: Smile     },
  { key: 'value',      label: 'Value',       icon: DollarSign},
];

const RATING_LABELS = ['', 'Terrible', 'Poor', 'Average', 'Good', 'Excellent'];

function StarRow({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <button
          key={s} type="button"
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star className={`w-6 h-6 transition-colors ${s <= display ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  );
}

export default function WriteReviewForm({ game, user, onSuccess }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [categoryRatings, setCategoryRatings] = useState({});
  const [reviewText, setReviewText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [inputMethod, setInputMethod] = useState('typed');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let finalTranscript = '';
      recognition.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i].transcript;
          if (e.results[i].isFinal) finalTranscript += t + ' ';
          else interim = t;
        }
        setReviewText(finalTranscript + interim);
      };
      recognition.onerror = () => {
        setIsListening(false);
        toast.error('Voice recognition error. Please try again.');
      };
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
    return () => recognitionRef.current?.stop();
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setReviewText('');
      recognitionRef.current.start();
      setIsListening(true);
      setInputMethod('voice');
    }
  };

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      if (!rating) throw new Error('Please select an overall star rating');
      if (!reviewText.trim()) throw new Error('Please write a review');

      await base44.entities.GameReview.create({
        game_id: game.id,
        user_id: user.id,
        user_name: user.full_name || 'Anonymous',
        rating,
        category_ratings: categoryRatings,
        review_text: reviewText.trim(),
        input_method: inputMethod,
      });

      // Update game's aggregate ratings
      const reviews = await base44.entities.GameReview.filter({ game_id: game.id });
      const avgRating = reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length;
      await base44.entities.Game.update(game.id, {
        average_rating: Math.round(avgRating * 10) / 10,
        total_ratings: reviews.length,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['game-reviews', game.id]);
      toast.success('Review submitted! Thank you 🎮');
      setRating(0); setReviewText(''); setCategoryRatings({}); setInputMethod('typed');
      if (onSuccess) onSuccess();
    },
    onError: (err) => toast.error(err.message || 'Failed to submit review'),
  });

  const displayRating = hoverRating || rating;

  return (
    <div className="border rounded-xl p-5 bg-gradient-to-br from-blue-50 to-purple-50 space-y-5">
      <h4 className="font-bold text-gray-900">Write a Review</h4>

      {/* Overall star rating */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Overall Rating</p>
        <div className="flex items-center gap-1">
          {[1,2,3,4,5].map(star => (
            <button
              key={star} type="button"
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
              className="focus:outline-none transition-transform hover:scale-110"
            >
              <Star className={`w-9 h-9 transition-colors ${star <= displayRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-sm font-semibold text-gray-700">{RATING_LABELS[rating]}</span>
          )}
        </div>
      </div>

      {/* Per-category ratings */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">Rate by Category <span className="text-gray-400 font-normal">(optional)</span></p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CATEGORY_LABELS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Icon className="w-4 h-4 text-indigo-500" />
                {label}
              </div>
              <StarRow
                value={categoryRatings[key] || 0}
                onChange={(v) => setCategoryRatings(prev => ({ ...prev, [key]: v }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Review text + voice */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">Your Review</p>
          {voiceSupported && (
            <button
              type="button"
              onClick={toggleVoice}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                isListening
                  ? 'bg-red-100 text-red-700 animate-pulse border border-red-300'
                  : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border border-indigo-200'
              }`}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {isListening ? 'Stop Recording' : 'Dictate Review'}
            </button>
          )}
        </div>

        {isListening && (
          <div className="flex items-center gap-2 mb-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Listening… speak your review now
          </div>
        )}

        <Textarea
          placeholder={`What did you think of ${game.title}? Share your experience…`}
          value={reviewText}
          onChange={(e) => { setReviewText(e.target.value); setInputMethod('typed'); }}
          rows={4}
          maxLength={1000}
          className="bg-white"
        />
        <div className="flex justify-between mt-1">
          {inputMethod === 'voice' && (
            <span className="text-xs text-indigo-600 flex items-center gap-1">
              <Mic className="w-3 h-3" /> Voice review
            </span>
          )}
          <span className="text-xs text-gray-400 ml-auto">{reviewText.length}/1000</span>
        </div>
      </div>

      <Button
        onClick={() => submitReviewMutation.mutate()}
        disabled={submitReviewMutation.isPending || !rating || !reviewText.trim()}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600"
      >
        {submitReviewMutation.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
        ) : (
          <><Send className="w-4 h-4 mr-2" /> Submit Review</>
        )}
      </Button>
    </div>
  );
}