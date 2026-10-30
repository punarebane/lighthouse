import { CONFIG } from '../data/config';

/** Derived player stats. Recomputed from upgrade + meta levels whenever they change. */
export interface Stats {
  hpMax: number;
  /** fraction of contact damage removed */
  armour: number;
  regen: number;
  rotSpeed: number;
  beamWidthMult: number;
  beamRangeMult: number;
  beamDpsMult: number;
  /** extra damage on the centre line of the beam (0..) */
  lensBonus: number;
  /** 0 = no second beam; else fraction of the main beam's dps */
  secondBeam: number;
  /** 0 = none; else fraction of main beam dps */
  thirdBeam: number;
  thirdBeamSpeed: number;
  flashCd: number; // 0 = off
  flashStun: number;
  flashDamage: number;
  harpoonCd: number; // 0 = off
  harpoonDamage: number;
  harpoonCount: number;
  harpoonPierce: number;
  chainCd: number; // 0 = off
  chainDamage: number;
  chainJumps: number;
  chainRange: number;
  burnDps: number; // 0 = off
  burnTime: number;
  drones: number;
  droneRadius: number;
  droneLight: number;
  droneDps: number;
  droneSpeed: number;
  foghornCd: number; // 0 = off
  foghornRadius: number;
  foghornForce: number;
  foghornDamage: number;
  magnetRadius: number;
  emberSpeedMult: number;
  glowRadius: number;
  glowDps: number;
  xpMult: number;
  /** fraction lit enemies are slowed */
  frost: number;
  coinMult: number;
  // evolutions
  twinSuns: boolean;
  thunderLanterns: boolean;
  wildfire: boolean;
  ballista: boolean;
}

export function baseStats(): Stats {
  const L = CONFIG.lighthouse;
  return {
    hpMax: L.hp, armour: 0, regen: 0, rotSpeed: L.rotSpeed,
    beamWidthMult: 1, beamRangeMult: 1, beamDpsMult: 1, lensBonus: 0,
    secondBeam: 0, thirdBeam: 0, thirdBeamSpeed: 0,
    flashCd: 0, flashStun: 0, flashDamage: 0,
    harpoonCd: 0, harpoonDamage: 0, harpoonCount: 0, harpoonPierce: 0,
    chainCd: 0, chainDamage: 0, chainJumps: 0, chainRange: 0,
    burnDps: 0, burnTime: 0,
    drones: 0, droneRadius: 0, droneLight: 0, droneDps: 0, droneSpeed: 0,
    foghornCd: 0, foghornRadius: 0, foghornForce: 0, foghornDamage: 0,
    magnetRadius: 0, emberSpeedMult: 1,
    glowRadius: L.glowRadius, glowDps: 0,
    xpMult: 1, frost: 0, coinMult: 1,
    twinSuns: false, thunderLanterns: false, wildfire: false, ballista: false,
  };
}
