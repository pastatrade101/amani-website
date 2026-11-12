/**
 * Real Key2africa photos from the CMS media library (Admin → Media Library),
 * used wherever the site needs a picture and the CMS record has none yet.
 * They replace the generated stand-in images that used to live in
 * /static/images. Each line names the media library file it points to.
 *
 * The CMS always wins: a section, destination, tour or category with its own
 * image shows that image. Swap a default here by copying another file's URL
 * from the media library ("Copy URL").
 */
const MEDIA = 'https://pub-53959842a05145498927ca5c30795929.r2.dev/media/';

export const PHOTO = {
	/** serengeti-073 · Hot-air balloon drifting over the golden plains */
	balloonPlains: `${MEDIA}6bcc7986-6a98-4383-b95a-eaa570b2da98.avif`,
	/** serengeti-072 · Hot-air balloons over the plains at dawn */
	balloonsDawn: `${MEDIA}a0259be5-6047-4e3b-9277-bad0b9f53ffa.avif`,
	/** serengeti-045 · Key2africa vehicle on a road above the plains */
	vehicleAbovePlains: `${MEDIA}a2cde881-d865-44f6-8b38-7889d9d1b8c7.avif`,
	/** serengeti-014 · Safari vehicles parked around an acacia tree on the plains */
	vehiclesAcacia: `${MEDIA}4af0c1e4-a9c0-4e78-a02f-8a742ea333a8.avif`,
	/** serengeti-042 · Acacia tree standing alone on the plains */
	acaciaAlone: `${MEDIA}20cfd640-51ae-4c3c-a09c-53f5a11bd607.avif`,
	/** serengeti-116 · Open grassland plains */
	openPlains: `${MEDIA}2336ed94-35c6-4c05-8b52-94b1c9ca4b05.avif`,
	/** serengeti-122 · Acacia trees in the morning haze */
	acaciaHaze: `${MEDIA}0011ee92-aa50-4926-b59f-16e34b3dc435.avif`,
	/** mkomazi-070 · Mkomazi plains below the hills */
	hillsPlains: `${MEDIA}04069c20-4295-4772-833b-a4eef34ecdab.avif`,
	/** serengeti-114 · Herd of wildebeest on the plains */
	wildebeest: `${MEDIA}286b7652-8c7a-4072-80ed-70a479018b36.avif`,
	/** serengeti-129 · Lion pride resting together */
	lionPride: `${MEDIA}942d83e5-2fda-4427-8995-5ebc9ccbb824.avif`,
	/** serengeti-126 · Black rhinos crossing the plains */
	rhinos: `${MEDIA}f9510b1e-3881-465d-9ae2-5a9b9824f485.avif`,
	/** tarangire-061 · Elephant on the plains in evening light */
	elephant: `${MEDIA}bb85a9a8-b4ea-4d69-8d20-b32cd57a00b0.avif`,
	/** tarangire-018 · Safari vehicles below a giant baobab tree */
	baobabVehicles: `${MEDIA}544b543b-e086-490f-b002-b29e7132b750.avif`,
	/** tarangire-042 · View through the pop-up roof of a safari vehicle */
	popUpRoofView: `${MEDIA}349e5f28-8701-4098-823f-5737d0541148.avif`,
	/** tarangire-043 · Guest standing up through the pop-up roof */
	guestPopUpRoof: `${MEDIA}05a0b62f-90dc-4f2b-8e48-66b1e6a4ee0c.avif`,
	/** tarangire-038 · Guests at a picnic table with their guide */
	guidePicnic: `${MEDIA}ebbca736-060c-44f4-bdac-f5775159a2ef.avif`,
	/** serengeti-048 · Safari tent looking out over the plains */
	tentPlains: `${MEDIA}c349b54c-fa2f-40ca-9e8a-a8d565a73b5c.avif`,
	/** serengeti-033 · Tented camp in the Serengeti */
	campTent: `${MEDIA}e8ca9a89-02e7-4d3d-bee4-9599dd0f0197.avif`,
	/** serengeti-005 · Key2africa vehicle at the Ngorongoro Conservation Area entrance gate */
	ngorongoroGate: `${MEDIA}49d37e68-e152-4f76-aad2-4fd1793bac59.avif`,
	/** zanzibar-001 · Boats moored off a Zanzibar beach */
	zanzibarBeach: `${MEDIA}bb2499d9-6ab9-4d11-9810-370ae7e69a6b.avif`,
	/** zanzibar-005 · Sunset over the Indian Ocean with boats offshore */
	zanzibarSunset: `${MEDIA}84de1e3e-0cb6-4d9d-a8a0-d7b0aa93ec0b.avif`,
	/** hadzabe-057 · Hadzabe hunters holding bows in front of a hollow baobab tree */
	hadzabe: `${MEDIA}996d7077-451e-406e-bb35-2d11c85ed004.avif`,
	/** The Key2africa team with guests beside the yellow Land Cruisers (the "Key2africa Safari Team" specialist photo) */
	teamWithGuests: `${MEDIA}494f639a-387f-47c4-bb17-5e6927291bbb.avif`
} as const;

export type PhotoKey = keyof typeof PHOTO;

/** Landscapes for places with no photo of their own: never an animal standing in for a place. */
export const LANDSCAPES: string[] = [PHOTO.openPlains, PHOTO.acaciaAlone, PHOTO.acaciaHaze, PHOTO.hillsPlains, PHOTO.vehiclesAcacia, PHOTO.vehicleAbovePlains];
