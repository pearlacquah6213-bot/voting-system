import { useEffect, useRef, useState } from 'react';
import { ExternalLink, MessageCircle, X } from 'lucide-react';
import {
  buildWhatsappUrl,
  formatGhanaIntlPhone,
  formatGhanaLocalPhone,
} from '../../lib/utils';

interface WhatsAppHoverWidgetProps {
  whatsappNumber?: string | null;
  developerName?: string | null;
  siteName?: string | null;
}

const QUICK_TOPICS = [
  {
    id: 'momo',
    label: 'MoMo Voting Help',
    template: 'Hello, I need help with Mobile Money / USSD voting on the awards portal.',
  },
  {
    id: 'receipt',
    label: 'Receipt Check',
    template: 'Hello, I would like assistance verifying my GH-2026 ballot receipt.',
  },
  {
    id: 'nominee',
    label: 'Nominee Enquiry',
    template: 'Hello, I have an enquiry regarding a nominee or awards category.',
  },
  {
    id: 'tech',
    label: 'Technical Support',
    template: 'Hello Pearlicious Tech Solutions, I need technical support with the portal.',
  },
];

export function WhatsAppHoverWidget({
  whatsappNumber,
  developerName,
  siteName,
}: WhatsAppHoverWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('momo');
  const [message, setMessage] = useState<string>(QUICK_TOPICS[0].template);
  const closeTimerRef = useRef<number | null>(null);

  const localDisplay = formatGhanaLocalPhone(whatsappNumber);
  const intlDisplay = formatGhanaIntlPhone(whatsappNumber);
  const devLabel = developerName?.trim() || 'Pearlicious Tech Solutions';
  const portalLabel = siteName?.trim() || 'Black Star Excellence Honours';

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    clearCloseTimer();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearCloseTimer();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const waHref = buildWhatsappUrl(
    whatsappNumber,
    `[${portalLabel}] ${message || 'Hello, I need assistance.'}`
  );

  return (
    <div
      className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Expandable Quick-Chat Popover */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="WhatsApp support quick chat"
          className="w-[320px] sm:w-[344px] max-w-[calc(100vw-2.5rem)] rounded-lg border border-slate-200 bg-white shadow-2xl overflow-hidden transition-opacity duration-150 motion-reduce:transition-none"
        >
          {/* Deep Navy Header */}
          <div className="bg-[#0B192C] text-white px-4 py-3.5 flex items-start justify-between gap-3 border-b border-[#1E3A5F]">
            <div className="space-y-0.5 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#D8B246]">
                WhatsApp Support Desk
              </p>
              <h3 className="font-serif text-base font-semibold text-white truncate">
                {portalLabel}
              </h3>
              <p className="text-[11px] font-mono tabular-nums text-slate-300">
                {localDisplay} · {intlDisplay}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close WhatsApp support box"
              className="h-7 w-7 inline-flex items-center justify-center rounded border border-[#1E3A5F] text-slate-300 hover:text-white hover:bg-[#132844] transition-colors cursor-pointer shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Topics & Custom Message */}
          <div className="p-4 space-y-3 bg-white">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Select Inquiry Topic
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_TOPICS.map((topic) => {
                  const active = selectedTopicId === topic.id;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => {
                        setSelectedTopicId(topic.id);
                        setMessage(topic.template);
                      }}
                      className={`px-2.5 py-1.5 rounded text-left text-xs font-medium border transition-colors cursor-pointer truncate ${
                        active
                          ? 'bg-[#0B192C] text-white border-[#0B192C]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#C59B27]'
                      }`}
                    >
                      {topic.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="wa-quick-message"
                className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500"
              >
                Your Message
              </label>
              <textarea
                id="wa-quick-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your question for our support desk..."
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-[#0B192C] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
              />
            </div>

            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#25D366] hover:bg-[#1EBA59] text-[#06101D] font-semibold text-xs px-4 py-2.5 transition-colors whitespace-nowrap"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span>Start WhatsApp Chat ({localDisplay})</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Technical Desk</span>
              <span className="font-semibold text-[#0B192C] truncate max-w-[190px]">
                {devLabel}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Hover / Tap Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={`Open WhatsApp support (${localDisplay})`}
        className="group h-12 inline-flex items-center gap-2.5 rounded-full bg-[#0B192C] hover:bg-[#132844] text-white border border-[#C59B27]/70 pl-2.5 pr-4 shadow-lg transition-all duration-150 motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
      >
        <span className="h-8 w-8 rounded-full bg-[#25D366] text-[#06101D] inline-flex items-center justify-center shrink-0">
          <MessageCircle className="h-4 w-4" />
        </span>
        <span className="text-left leading-tight whitespace-nowrap shrink-0">
          <span className="block text-xs font-semibold text-white">WhatsApp Help</span>
          <span className="block text-[11px] font-mono tabular-nums text-[#D8B246]">
            {localDisplay}
          </span>
        </span>
      </button>
    </div>
  );
}
