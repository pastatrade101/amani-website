// Reference copy and photos supplied in tanzania-safari-pages.zip.
// These are display fallbacks only; they are never inserted into the database.
import type { Activity, Destination } from '$lib/types/api';
import { PHOTO } from '../media-photos';
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');

const experienceCopy = [
  { title: "Great Migration", description: "Witness the spectacular movement of millions of wildebeest and other wildlife across the Serengeti.", cta: "Explore Great Migration", image: PHOTO.wildebeest },
  { title: "Big Five", description: "See lions, leopards, elephants, buffalo and rhinos in their natural habitat.", cta: "Explore", image: PHOTO.lionPride },
  { title: "Serengeti", description: "Explore vast plains, abundant wildlife and breathtaking African sunsets.", cta: "Explore", image: PHOTO.wildebeest },
  { title: "Ngorongoro Crater", description: "Discover a natural wonder with an incredible concentration of wildlife.", cta: "Explore", image: PHOTO.hillsPlains },
  { title: "Elephant Encounters", description: "Get close to majestic elephants in iconic parks like Tarangire and Serengeti.", cta: "Explore", image: PHOTO.elephant },
  { title: "Safari + Zanzibar", description: "Combine your safari with relaxing beach time on the spice island of Zanzibar.", cta: "Explore", image: PHOTO.zanzibarBeach },
];

export const referenceActivities: Activity[] = experienceCopy.map((item) => ({ id: `reference-${slug(item.title)}`, name: item.title, slug: slug(item.title), description: item.description, image_url: item.image }));

export const circuits = [
  {
    id: "northern",
    label: "Northern Circuit",
    items: [
      { title: "Serengeti National Park", text: "Endless plains, abundant wildlife and the Great Migration.", image: PHOTO.wildebeest, href: "#" },
      { title: "Lake Manyara", text: "Wildlife, forests and Rift Valley scenery.", image: PHOTO.openPlains, href: "#" },
      { title: "Ngorongoro Crater", text: "Discover one of Africa's most remarkable wildlife landscapes.", image: PHOTO.ngorongoroGate, href: "#" },
      { title: "Tarangire National Park", text: "Famous for elephants and baobabs.", image: PHOTO.baobabVehicles, href: "#" },
      { title: "Great Migration", text: "Follow the herds across the northern plains.", image: PHOTO.popUpRoofView, href: "#" },
      { title: "Arusha", text: "Forest walks and Mount Meru views.", image: PHOTO.rhinos, href: "#" },
    ],
  },
  {
    id: "southern",
    label: "Southern Circuit",
    items: [
      { title: "Nyerere National Park", text: "Vast wilderness, river safaris and remote game drives.", image: PHOTO.popUpRoofView, href: "#" },
      { title: "Ruaha National Park", text: "Rugged landscapes, big cats and large elephant herds.", image: PHOTO.lionPride, href: "#" },
      { title: "Mikumi National Park", text: "Open floodplains and easy-to-reach wildlife viewing.", image: PHOTO.elephant, href: "#" },
      { title: "Udzungwa Mountains", text: "Rainforest trails, waterfalls and rare primates.", image: PHOTO.acaciaAlone, href: "#" },
      { title: "Rufiji River", text: "Boat safaris among hippos, crocodiles and birdlife.", image: PHOTO.hillsPlains, href: "#" },
      { title: "Iringa Highlands", text: "Cool highland scenery on the road to Ruaha.", image: PHOTO.rhinos, href: "#" },
    ],
  },
  {
    id: "western",
    label: "Western Circuit",
    items: [
      { title: "Mahale Mountains", text: "Remote forested mountains beside the lake.", image: PHOTO.hillsPlains, href: "#" },
      { title: "Katavi National Park", text: "Untouched wilderness far from the crowds.", image: PHOTO.rhinos, href: "#" },
      { title: "Lake Tanganyika", text: "Clear waters and quiet beaches in the far west.", image: PHOTO.acaciaAlone, href: "#" },
      { title: "Gombe Stream National Park", text: "Chimpanzee trekking in lakeside forest.", image: PHOTO.popUpRoofView, href: "#" },
      { title: "Rubondo Island", text: "A secluded island park on Lake Victoria.", image: PHOTO.elephant, href: "#" },
      { title: "Kigoma", text: "Lakeside gateway to the western parks.", image: PHOTO.lionPride, href: "#" },
    ],
  },
  {
    id: "coast",
    label: "Zanzibar & Coast",
    items: [
      { title: "Zanzibar", text: "Extend your safari with a relaxing Indian Ocean escape.", image: PHOTO.zanzibarBeach, href: "#" },
      { title: "Pemba Island", text: "A quieter island escape in the Indian Ocean.", image: PHOTO.zanzibarSunset, href: "#" },
      { title: "Mafia Island", text: "Peaceful island life and marine adventures.", image: PHOTO.zanzibarBeach, href: "#" },
      { title: "Tanzania Coast", text: "Palm-lined beaches along the mainland shore.", image: PHOTO.zanzibarSunset, href: "#" },
      { title: "Stone Town", text: "Historic alleys, spice markets and Swahili heritage.", image: PHOTO.zanzibarSunset, href: "#" },
      { title: "Saadani National Park", text: "Where wildlife meets the Indian Ocean beach.", image: PHOTO.popUpRoofView, href: "#" },
    ],
  },
];

export const referenceDestinations: Destination[] = circuits.flatMap((circuit) => circuit.items.map((item) => ({ id: `reference-${slug(item.title)}`, name: item.title, slug: slug(item.title), country: "Tanzania", region: circuit.label, short_description: item.text, image_url: item.image })));

export const heroSlides = [
{ src: PHOTO.balloonPlains, alt: "Elephants on the savannah beside a safari vehicle" },
{ src: PHOTO.acaciaHaze, alt: "Lions on a rocky kopje in the Serengeti" },
{ src: PHOTO.balloonsDawn, alt: "Hot air balloons over the Serengeti plains" }
];
