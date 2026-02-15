// Type definitions for Site Content
export interface SiteContent {
  id?: string;
  hero_title: string;
  hero_subtitle: string;
  about_title: string;
  about_text: string;
  footer_text: string;
  address: string;
  phone: string;
  instagram: string;
  updated_at?: string;
}

export interface GalleryItem {
  id?: string;
  image_url: string;
  caption: string;
  display_order: number;
  created_at?: string;
}

// Supabase Logic
import { supabase } from "./supabaseClient";

/**
 * Fetch the single row of site content
 */
export async function fetchSiteContent(): Promise<SiteContent> {
  try {
    if (!supabase) return defaultContent;

    const { data, error } = await supabase
      .from('site_content')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.warn('Using default content (Supabase fetch failed):', error.message);
      return defaultContent;
    }

    if (!data) {
      return defaultContent;
    }

    return data as SiteContent;
  } catch (err) {
    console.error('Unexpected error fetching content:', err);
    return defaultContent;
  }
}

/**
 * Update the site content
 */
export async function updateSiteContent(content: SiteContent): Promise<{ success: boolean; error?: string }> {
  try {
    if (!supabase) return { success: false, error: "Supabase not configured" };

    // We assume there is only one row, so we update the one with the known ID or just update logic
    // Since we limit(1) in fetch, we can just update WHERE id matches (if we had it)
    // Or simpler: update ANY row because there should only be one.
    // Better: Update where id is NOT NULL (safety) or use the ID from the fetch.
    
    // For safety, let's fetch the ID first if not provided
    let targetId = content.id;
    if (!targetId) {
       const { data } = await supabase.from('site_content').select('id').limit(1).single();
       if (data) targetId = data.id;
    }

    if (!targetId) {
      return { success: false, error: "No content record found to update." };
    }

    const { error } = await supabase
      .from('site_content')
      .update({
        hero_title: content.hero_title,
        hero_subtitle: content.hero_subtitle,
        about_title: content.about_title,
        about_text: content.about_text,
        footer_text: content.footer_text,
        address: content.address,
        phone: content.phone,
        instagram: content.instagram,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error updating content:', err);
    return { success: false, error: err.message || 'Update failed' };
  }
}

/**
 * Fetch gallery images
 */
export async function fetchGallery(): Promise<GalleryItem[]> {
  try {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as GalleryItem[]) || [];
  } catch (err) {
    console.warn('Using local gallery (fetch failed):', err);
    return []; // Return empty or local fallback in UI
  }
}

/**
 * Add image to gallery
 */
export async function addGalleryItem(url: string, caption: string): Promise<boolean> {
  try {
    if (!supabase) return false;

    const { error } = await supabase
      .from('gallery')
      .insert([{ image_url: url, caption: caption }]);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error adding image:', err);
    return false;
  }
}

/**
 * Upload image to gallery bucket and return URL
 */
export async function uploadGalleryImage(file: File): Promise<string | null> {
  try {
    if (!supabase) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('gallery')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('gallery')
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (err) {
    console.error('Error uploading image:', err);
    return null;
  }
}

/**
 * Delete image from gallery
 */
export async function deleteGalleryItem(id: string): Promise<boolean> {
  try {
    if (!supabase) return false;

    const { error } = await supabase
      .from('gallery')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting image:', err);
    return false;
  }
}

// Default Fallback Content
export const defaultContent: SiteContent = {
  hero_title: 'Estúdio 3M',
  hero_subtitle: 'Corte - Barba - Sobrancelha - Manicure',
  about_title: 'A Barbearia',
  about_text: 'Mais que um corte, uma experiência. No Estúdio 3M, unimos a tradição da barbearia clássica com a praticidade moderna.',
  footer_text: 'O visual clássico com a atitude moderna.',
  address: 'Rua Exemplo, 123 - Aracaju, SE',
  phone: '(79) 99999-9999',
  instagram: '@estudio3m'
};
