import { Button } from "@/components/ui/button";
import { BUSINESS_CONFIG } from "@/lib/data";

export function WhatsAppButton() {
  const phoneNumber = BUSINESS_CONFIG.phone; 
  const message = encodeURIComponent("Olá! Gostaria de tirar uma dúvida sobre o Estúdio 3M.");
  const whatsappUrl = `https://wa.me/55${phoneNumber}?text=${message}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 hover:-translate-y-1 transition-transform"
      title="Fale conosco no WhatsApp"
    >
      <div className="bg-[#25D366] text-white p-3 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center hover:bg-[#128C7E] transition-colors">
        <svg 
          viewBox="0 0 24 24" 
          width="32" 
          height="32" 
          stroke="currentColor" 
          strokeWidth="2" 
          fill="white" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="w-8 h-8"
        >
          <path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.07 0C5.537 0 .227 5.33.227 11.87c0 2.089.544 4.104 1.578 5.884l-1.666 6.088 6.262-1.642a11.832 11.832 0 005.671 1.45h.005c6.533 0 11.844-5.328 11.844-11.868 0-3.17-.678-5.696-1.841-8.127z" fill="white" stroke="none" />
        </svg>
      </div>
    </a>
  );
}
