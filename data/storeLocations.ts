/**
 * Reference file — store coordinates are now stored in the Supabase `stores` table
 * (latitude / longitude columns).
 *
 * This file is kept as a quick reference for the current store locations.
 * To update coordinates, run SQL against your Supabase database:
 *
 *   UPDATE public.stores SET latitude = -20.XXXX, longitude = 57.XXXX
 *   WHERE id = '<store-uuid>';
 */

export const storeCoordinateReference = [
  // Intermart
  { name: 'Intermart Grand Baie', id: '174061e8-fb6a-44aa-87b5-de566bbe6733', lat: -20.0174, lng: 57.5801 },
  { name: 'Intermart Calodyne',   id: '92d570c2-ccc4-429f-9be6-6344aa01af67', lat: -20.0130, lng: 57.6150 },

  // Super U
  { name: 'Super U Goodlands',    id: '890e6990-a36e-40d9-af31-a735c9d5634a', lat: -20.0348, lng: 57.6502 },
  { name: 'Super U Grand Baie',   id: 'dd537da6-725b-4ad3-9d15-8d00e10e8e53', lat: -20.0174, lng: 57.5820 },

  // Winners
  { name: 'Winners Pereybere',    id: '8e0065d6-27e6-4522-8777-41bddbce2a70', lat: -20.0080, lng: 57.5850 },
  { name: 'Winners Goodlands',    id: 'c3028253-0c7c-49ce-b3d1-02fbb3ec2037', lat: -20.0348, lng: 57.6480 },
];
