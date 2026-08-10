-- 0107: anc-22047 (Anchor Spike Guard) - Google Merchant Center could not
-- process its CloudFront-hosted image ("Image not processed", 10 Aug 2026
-- disapproval CSV). Rehosted to our storage with a 1-year cache header;
-- pointing the product there fixes fetchability for Google and our pages.
update public.products
  set image_url = 'https://jfgsigpadpewfktsohmc.supabase.co/storage/v1/object/public/product-images/rehosted/anc-22047.png'
  where id = 'anc-22047';
