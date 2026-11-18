import { useState, type FormEvent } from 'react';
import { CheckCircle2, Code2, ExternalLink, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '../../lib/api';
import {
  buildWhatsappUrl,
  formatGhanaIntlPhone,
  formatGhanaLocalPhone,
} from '../../lib/utils';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input, Textarea } from '../ui/input';
import type { PublicBootstrap } from '../../types';

interface ContactPageProps {
  bootstrap: PublicBootstrap;
}

export function ContactPage({ bootstrap }: ContactPageProps) {
  const { settings } = bootstrap;
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await apiRequest('/api/public/contact', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, subject, message }),
      });
      setSent(true);
      setFullName('');
      setEmail('');
      setSubject('');
      setMessage('');
      toast.success('Your inquiry has been delivered to the Secretariat.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-[75vh]">
      <section className="bg-[#0B192C] text-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#D8B246]">
            Secretariat Desk
          </p>
          <h1 className="font-serif text-4xl font-semibold">Contact Us</h1>
          <p className="text-sm text-slate-300 max-w-xl">
            Reach our governance office for nominee accreditation, media press passes, sponsorship inquiries, or voter verification assistance.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-5">
            <Card className="p-6 bg-white space-y-5">
              <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">
                Direct Channels
              </h2>
              <div className="space-y-4 text-sm text-slate-700">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-[#C59B27] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-[#0B192C]">Email</p>
                    <p>{settings?.contactEmail}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-[#C59B27] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-[#0B192C]">Telephone</p>
                    <p>{settings?.contactPhone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-[#C59B27] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-[#0B192C]">Address</p>
                    <p>{settings?.contactAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MessageCircle className="h-5 w-5 text-[#25D366] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-[#0B192C]">WhatsApp Helpdesk</p>
                    <a
                      href={buildWhatsappUrl(
                        settings?.whatsappNumber,
                        `Hello ${settings?.siteName || 'Secretariat'}, I need support.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono tabular-nums text-[#0B192C] hover:text-[#9F7915] underline decoration-[#C59B27]/60 underline-offset-4"
                    >
                      {formatGhanaLocalPhone(settings?.whatsappNumber)} ({formatGhanaIntlPhone(settings?.whatsappNumber)})
                    </a>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-[#0B192C] text-white space-y-4 border border-[#1E3A5F]">
              <div className="flex items-center gap-2.5 text-[#D8B246]">
                <Code2 className="h-5 w-5 shrink-0" />
                <p className="text-xs font-semibold uppercase tracking-widest">
                  Developer &amp; Technical Support
                </p>
              </div>
              <div className="space-y-1.5">
                <h3 className="font-serif text-xl font-semibold text-white">
                  {settings?.developerName || 'Pearlicious Tech Solutions'}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Official platform engineering, MoMo/USSD integration, and technical support partner. Reach our engineering team directly on WhatsApp for portal assistance.
                </p>
              </div>
              <div className="pt-1 flex flex-wrap items-center justify-between gap-3 border-t border-[#1E3A5F]">
                <span className="text-xs font-mono tabular-nums text-[#D8B246]">
                  {formatGhanaLocalPhone(settings?.whatsappNumber)}
                </span>
                <a
                  href={buildWhatsappUrl(
                    settings?.whatsappNumber,
                    `Hello ${settings?.developerName || 'Pearlicious Tech Solutions'}, I need technical support regarding ${settings?.siteName || 'the voting portal'}.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-[#25D366] hover:bg-[#1EBA59] text-[#06101D] font-semibold text-xs px-3.5 py-2 transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  <span>Message on WhatsApp</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              </div>
            </Card>
          </div>

          <Card className="lg:col-span-7 p-8 bg-white">
            {sent ? (
              <div className="py-10 text-center space-y-4">
                <CheckCircle2 className="h-10 w-10 text-[#C59B27] mx-auto" />
                <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">
                  Message Received
                </h2>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Thank you for contacting {settings?.siteName}. A member of our secretariat will respond within one business day.
                </p>
                <Button variant="outline" onClick={() => setSent(false)}>
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">
                  Send an Inquiry
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Full Name</label>
                    <Input
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Email Address</label>
                    <Input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@organization.org"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Subject</label>
                  <Input
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Nomination dossier, media accreditation, or technical support"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Message</label>
                  <Textarea
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your message..."
                  />
                </div>
                <Button type="submit" variant="gold" size="lg" disabled={sending}>
                  {sending ? 'Sending...' : 'Submit Inquiry'}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
