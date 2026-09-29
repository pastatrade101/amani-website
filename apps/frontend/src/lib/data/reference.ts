// Reference copy and photos supplied in tanzania-safari-pages.zip.
// These are display fallbacks only; they are never inserted into the database.
import type { Activity, Destination } from '$lib/types/api';
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');

const experienceCopy = [
  { title: "Great Migration", description: "Witness the spectacular movement of millions of wildebeest and other wildlife across the Serengeti.", cta: "Explore Great Migration", image: "/images/related-wildebeest.jpg" },
  { title: "Big Five", description: "See lions, leopards, elephants, buffalo and rhinos in their natural habitat.", cta: "Explore", image: "/images/itinerary-lions.jpg" },
  { title: "Serengeti", description: "Explore vast plains, abundant wildlife and breathtaking African sunsets.", cta: "Explore", image: "/images/serengeti.jpg" },
  { title: "Ngorongoro Crater", description: "Discover a natural wonder with an incredible concentration of wildlife.", cta: "Explore", image: "/images/itinerary-crater.jpg" },
  { title: "Elephant Encounters", description: "Get close to majestic elephants in iconic parks like Tarangire and Serengeti.", cta: "Explore", image: "/images/itinerary-elephants.jpg" },
  { title: "Safari + Zanzibar", description: "Combine your safari with relaxing beach time on the spice island of Zanzibar.", cta: "Explore", image: "/images/experience-zanzibar.jpg" },
];

export const referenceActivities: Activity[] = experienceCopy.map((item) => ({ id: `reference-${slug(item.title)}`, name: item.title, slug: slug(item.title), description: item.description, image_url: item.image }));

export const circuits = [
  {
    id: "northern",
    label: "Northern Circuit",
    items: [
      { title: "Serengeti National Park", text: "Endless plains, abundant wildlife and the Great Migration.", image: "/images/serengeti.jpg", href: "#" },
      { title: "Lake Manyara", text: "Wildlife, forests and Rift Valley scenery.", image: "/images/lake-manyara.jpg", href: "#" },
      { title: "Ngorongoro Crater", text: "Discover one of Africa's most remarkable wildlife landscapes.", image: "/images/ngorongoro.jpg", href: "#" },
      { title: "Tarangire National Park", text: "Famous for elephants and baobabs.", image: "/images/tarangire.jpg", href: "#" },
      { title: "Great Migration", text: "Follow the herds across the northern plains.", image: "/images/itinerary-game-drive.jpg", href: "#" },
      { title: "Arusha", text: "Forest walks and Mount Meru views.", image: "/images/itinerary-rhino.jpg", href: "#" },
    ],
  },
  {
    id: "southern",
    label: "Southern Circuit",
    items: [
      { title: "Nyerere National Park", text: "Vast wilderness, river safaris and remote game drives.", image: "/images/itinerary-game-drive.jpg", href: "#" },
      { title: "Ruaha National Park", text: "Rugged landscapes, big cats and large elephant herds.", image: "/images/itinerary-lions.jpg", href: "#" },
      { title: "Mikumi National Park", text: "Open floodplains and easy-to-reach wildlife viewing.", image: "/images/itinerary-elephants.jpg", href: "#" },
      { title: "Udzungwa Mountains", text: "Rainforest trails, waterfalls and rare primates.", image: "/images/itinerary-baobab-sunset.jpg", href: "#" },
      { title: "Rufiji River", text: "Boat safaris among hippos, crocodiles and birdlife.", image: "/images/itinerary-crater.jpg", href: "#" },
      { title: "Iringa Highlands", text: "Cool highland scenery on the road to Ruaha.", image: "/images/itinerary-rhino.jpg", href: "#" },
    ],
  },
  {
    id: "western",
    label: "Western Circuit",
    items: [
      { title: "Mahale Mountains", text: "Remote forested mountains beside the lake.", image: "/images/itinerary-crater.jpg", href: "#" },
      { title: "Katavi National Park", text: "Untouched wilderness far from the crowds.", image: "/images/itinerary-rhino.jpg", href: "#" },
      { title: "Lake Tanganyika", text: "Clear waters and quiet beaches in the far west.", image: "/images/itinerary-baobab-sunset.jpg", href: "#" },
      { title: "Gombe Stream National Park", text: "Chimpanzee trekking in lakeside forest.", image: "/images/itinerary-game-drive.jpg", href: "#" },
      { title: "Rubondo Island", text: "A secluded island park on Lake Victoria.", image: "/images/itinerary-elephants.jpg", href: "#" },
      { title: "Kigoma", text: "Lakeside gateway to the western parks.", image: "/images/itinerary-lions.jpg", href: "#" },
    ],
  },
  {
    id: "coast",
    label: "Zanzibar & Coast",
    items: [
      { title: "Zanzibar", text: "Extend your safari with a relaxing Indian Ocean escape.", image: "/images/experience-zanzibar.jpg", href: "#" },
      { title: "Pemba Island", text: "A quieter island escape in the Indian Ocean.", image: "/images/zanzibar-menu.jpg", href: "#" },
      { title: "Mafia Island", text: "Peaceful island life and marine adventures.", image: "/images/experience-zanzibar.jpg", href: "#" },
      { title: "Tanzania Coast", text: "Palm-lined beaches along the mainland shore.", image: "/images/zanzibar-menu.jpg", href: "#" },
      { title: "Stone Town", text: "Historic alleys, spice markets and Swahili heritage.", image: "/images/zanzibar-menu.jpg", href: "#" },
      { title: "Saadani National Park", text: "Where wildlife meets the Indian Ocean beach.", image: "/images/itinerary-game-drive.jpg", href: "#" },
    ],
  },
];

export const referenceDestinations: Destination[] = circuits.flatMap((circuit) => circuit.items.map((item) => ({ id: `reference-${slug(item.title)}`, name: item.title, slug: slug(item.title), country: "Tanzania", region: circuit.label, short_description: item.text, image_url: item.image })));

export const heroSlides = [
{ src: "/images/tanzania-safari-hero.jpg", alt: "Elephants on the savannah beside a safari vehicle" },
{ src: "/images/tanzania-hero-2.jpg", alt: "Lions on a rocky kopje in the Serengeti" },
{ src: "/images/tanzania-hero-3.jpg", alt: "Hot air balloons over the Serengeti plains" }
];
