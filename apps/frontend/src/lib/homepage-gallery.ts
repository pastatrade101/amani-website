export type GalleryPhoto = { id: string; image_url: string; title?: string | null; alt_text?: string | null; caption?: string | null; status?: string; media_type?: string; sort_order?: number };
export function publishedGallery(rows: GalleryPhoto[]): GalleryPhoto[] {
 return rows.filter(row => row.status === 'published' && row.media_type === 'image' && /^https?:\/\/|^\/(?!\/)/.test(row.image_url)).sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).slice(0,24);
}
