import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Scissors } from "lucide-react";

export function Header() {
  const scrollToBooking = () => {
    const bookingSection = document.getElementById("booking-section");
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: "smooth" });
    } else {
      window.location.hash = "/";
      setTimeout(() => {
        const el = document.getElementById("booking-section");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b-4 border-black">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <Link href="/">
          <a className="flex items-center gap-3 group">
            <div className="bg-black p-2 text-white">
              <Scissors className="w-6 h-6" />
            </div>
            <span className="font-serif text-2xl font-black uppercase tracking-tighter text-black group-hover:text-accent transition-colors">
              Estúdio 3M
            </span>
          </a>
        </Link>
        
        <nav className="flex items-center gap-6">
          <Link href="/admin">
            <a className="text-sm font-bold uppercase tracking-widest hover:underline decoration-2 underline-offset-4">
              Admin Area
            </a>
          </Link>
          <Button 
            size="sm" 
            className="hidden sm:flex rounded-none border-2 border-black bg-black text-white hover:bg-white hover:text-black font-bold uppercase tracking-wider text-xs px-6"
            onClick={scrollToBooking}
          >
            Agendar
          </Button>
        </nav>
      </div>
    </header>
  );
}
