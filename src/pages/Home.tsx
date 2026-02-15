import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { BookingWizard } from "@/components/BookingWizard";
import { Button } from "@/components/ui/button";
import { ArrowDown, Globe, Instagram } from "lucide-react";
import heroImg from "@/assets/hero_new.jpg";
import { Calendar, Smartphone, Star, Clock, Quote } from "lucide-react";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { BUSINESS_CONFIG } from "@/lib/data";
import { fetchSiteContent, fetchGallery, type SiteContent, type GalleryItem, defaultContent } from "@/lib/contentManager";

// Fallback images if gallery is empty
import portfolio1 from "@/assets/portfolio1.jpg";
import portfolio2 from "@/assets/portfolio2.jpg";
import portfolio3 from "@/assets/portfolio3.jpg";

export default function Home() {
  const [content, setContent] = useState<SiteContent>(defaultContent);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  useEffect(() => {
    // Fetch dynamic content on load
    const loadData = async () => {
        const siteData = await fetchSiteContent();
        setContent(siteData);
        const galleryData = await fetchGallery();
        setGallery(galleryData);
    };
    loadData();
  }, []);

  const scrollToBooking = () => {
    document.getElementById("booking-section")?.scrollIntoView({ behavior: "smooth" });
  };

  // Use fallback images if no dynamic gallery exists
  const displayGallery = gallery.length > 0 ? gallery : [
      { image_url: portfolio1, caption: "Corte Clássico" },
      { image_url: portfolio2, caption: "Barba e Bigode" },
      { image_url: portfolio3, caption: "Estilo Moderno" }
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground bg-white selection:bg-accent selection:text-white">
      <Header />
      <WhatsAppButton />
      
      {/* Hero Section */}
      <section className="relative pt-20 pb-0 md:pt-24 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            
            {/* Left: Illustration */}
            <div className="relative order-2 md:order-1 animate-in fade-in slide-in-from-left-8 duration-1000">
              <div className="border-4 border-black p-2 bg-white rotate-1 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <img 
                  src={heroImg} 
                  alt="Barber Shop Illustration" 
                  className="w-full h-auto object-cover grayscale contrast-125"
                />
              </div>
            </div>

            {/* Right: Typography */}
            <div className="flex flex-col justify-center text-left space-y-6 order-1 md:order-2 animate-in fade-in slide-in-from-right-8 duration-1000">
              <div>
                <h1 className="text-4xl sm:text-6xl md:text-8xl font-serif font-black uppercase leading-none tracking-tighter text-black mb-2">
                  {content.hero_title}
                </h1>
              </div>
              
              <p className="text-lg md:text-xl font-bold uppercase tracking-[0.2em] text-black">
                {content.hero_subtitle}
              </p>
              
              <div className="w-24 h-2 bg-black my-4" />
              
              <div className="space-y-1">
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Segunda a Sábado
                </p>
                <p className="text-3xl md:text-4xl font-black font-serif text-black">
                  {BUSINESS_CONFIG.openTime} - {BUSINESS_CONFIG.closeTime}
                </p>
              </div>

              <div className="flex items-center gap-2 font-bold underline decoration-2 underline-offset-4">
                <Globe className="w-5 h-5" />
                <span>www.estudio3m.com.br</span>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  className="bg-black text-white hover:bg-neutral-800 text-xl font-serif px-8 py-6 rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(206,32,41,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                  onClick={scrollToBooking}
                >
                  Agendar Agora
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="bg-white text-black hover:bg-neutral-100 text-xl font-serif px-8 py-6 rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                  onClick={scrollToBooking}
                >
                  Nossos Serviços
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stripe Divider */}
      <div className="w-full h-8 barber-stripes my-16 border-y-4 border-black" />

      {/* About Section (Institutional) */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-serif font-black mb-4 text-black uppercase">
              {content.about_title}
            </h2>
            <div className="w-24 h-2 bg-yellow-pattern mx-auto" />
            <p className="mt-6 text-lg text-neutral-600 max-w-2xl mx-auto font-medium">
              {content.about_text}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="border-4 border-black p-8 hover:-translate-y-2 transition-transform bg-white shadow-[8px_8px_0px_0px_rgba(255,215,0,1)]">
              <div className="w-16 h-16 bg-black text-white flex items-center justify-center mb-6">
                <Smartphone className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-2xl font-bold mb-4">Agendamento Online</h3>
              <p className="text-neutral-600 font-medium">
                Sem filas e sem espera. Escolha seu barbeiro, o serviço e o horário direto pelo celular em segundos.
              </p>
            </div>

            <div className="border-4 border-black p-8 hover:-translate-y-2 transition-transform bg-white shadow-[8px_8px_0px_0px_rgba(255,215,0,1)]">
              <div className="w-16 h-16 bg-black text-white flex items-center justify-center mb-6">
                <Star className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-2xl font-bold mb-4">Profissionais Elite</h3>
              <p className="text-neutral-600 font-medium">
                Nossa equipe é especializada em cortes modernos, degradês perfeitos e barboterapia.
              </p>
            </div>

            <div className="border-4 border-black p-8 hover:-translate-y-2 transition-transform bg-white shadow-[8px_8px_0px_0px_rgba(255,215,0,1)]">
              <div className="w-16 h-16 bg-black text-white flex items-center justify-center mb-6">
                <Clock className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-2xl font-bold mb-4">Pontualidade</h3>
              <p className="text-neutral-600 font-medium">
                Respeitamos seu tempo. Seu horário é garantido e o serviço é executado com maestria.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-16 px-4 bg-neutral-50 border-y-4 border-black">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-black mb-4 text-black uppercase">
              Nosso Trabalho
            </h2>
            <div className="w-24 h-2 bg-yellow-pattern mx-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {displayGallery.map((item, i) => (
              <div key={i} className="group relative border-4 border-black overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all bg-white">
                <img 
                  src={item.image_url} 
                  alt={item.caption || `Portfolio ${i+1}`} 
                  className="w-full h-80 object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-yellow-400/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                {item.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white p-2 text-center transform translate-y-full group-hover:translate-y-0 transition-transform">
                        <p className="text-xs font-bold uppercase tracking-wider">{item.caption}</p>
                    </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Button 
              size="lg" 
              className="bg-black text-white hover:bg-neutral-800 text-xl font-serif px-12 py-6 rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(255,215,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              onClick={scrollToBooking}
            >
              Quero esse Estilo
            </Button>
          </div>
        </div>
      </section>

      {/* Stripe Divider */}
      <div className="w-full h-8 barber-stripes my-16 border-y-4 border-black" />

      {/* Testimonials Section */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-serif font-black mb-4 text-black uppercase">
              Cliente Satisfeito
            </h2>
            <div className="w-24 h-2 bg-yellow-pattern mx-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-neutral-50 p-8 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
              <Quote className="w-12 h-12 text-accent absolute -top-6 -left-2 bg-white border-2 border-black p-2" />
              <p className="text-neutral-600 font-medium italic mb-6 pt-4">
                "Melhor corte de Aracaju! O ambiente é top e o atendimento do Luis é nota 10. Saí de lá outro homem."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-black rounded-full border-2 border-black"></div>
                <div>
                  <p className="font-bold font-serif uppercase">Carlos Eduardo</p>
                  <div className="flex text-accent">
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-neutral-50 p-8 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
              <Quote className="w-12 h-12 text-accent absolute -top-6 -left-2 bg-white border-2 border-black p-2" />
              <p className="text-neutral-600 font-medium italic mb-6 pt-4">
                "Agendamento super fácil pelo site. Cheguei e fui atendido na hora, sem aquela espera chata de barbearia comum."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-black rounded-full border-2 border-black"></div>
                <div>
                  <p className="font-bold font-serif uppercase">Felipe Santos</p>
                  <div className="flex text-accent">
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-neutral-50 p-8 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
              <Quote className="w-12 h-12 text-accent absolute -top-6 -left-2 bg-white border-2 border-black p-2" />
              <p className="text-neutral-600 font-medium italic mb-6 pt-4">
                "Barba e cabelo na régua. Profissionais de alta qualidade que entendem o que a gente pede. Virei cliente fiel."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-black rounded-full border-2 border-black"></div>
                <div>
                  <p className="font-bold font-serif uppercase">Rodrigo M.</p>
                  <div className="flex text-accent">
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stripe Divider */}
      <div className="w-full h-8 barber-stripes my-16 border-y-4 border-black" />

      {/* Booking Section */}
      <section id="booking-section" className="py-12 px-4 bg-white relative">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-black mb-4 text-black uppercase">
              Faça seu Agendamento
            </h2>
            <div className="w-full max-w-[200px] h-1 bg-black mx-auto" />
          </div>

          <BookingWizard />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white py-16 border-t-8 border-accent">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
          <div>
            <h3 className="font-serif text-3xl font-bold mb-6 text-white uppercase tracking-wider">
              {content.hero_title}
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed max-w-xs mx-auto md:mx-0">
              {content.footer_text}
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-6 uppercase text-lg tracking-widest border-b-2 border-accent inline-block pb-1">
              Contato
            </h4>
            <ul className="space-y-3 text-sm text-neutral-300">
              <li className="font-medium text-white text-lg">{content.phone}</li>
              <li className="flex items-center gap-2 justify-center md:justify-start">
                  <Instagram className="w-4 h-4" /> {content.instagram}
              </li>
              <li>{content.address}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6 uppercase text-lg tracking-widest border-b-2 border-accent inline-block pb-1">
              Horários
            </h4>
            <ul className="space-y-3 text-sm text-neutral-300">
              <li>Seg - Sex: {BUSINESS_CONFIG.openTime} - {BUSINESS_CONFIG.closeTime}</li>
              <li>Sábado: 09:00 - 17:00</li>
              <li>Domingo: Fechado</li>
            </ul>
          </div>
        </div>
        
        {/* Bottom Stripes */}
        <div className="mt-16 h-4 barber-stripes w-full opacity-80" />
        
        <div className="py-6 bg-black text-center text-xs text-neutral-500 font-medium uppercase tracking-widest">
          © {new Date().getFullYear()} Estúdio 3M. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
