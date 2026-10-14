import {
  Apple, Baby, Banknote, Bike, BookOpen, Briefcase, Bus, Cake, Car, Coffee, Coins, CreditCard, Dumbbell, Film, Fuel,
  Gamepad2, Gift, GraduationCap, HandCoins, HandHeart, Heart, Home, Hammer, Landmark, Laptop, Lightbulb, Music, Package,
  ParkingCircle, PawPrint, Pill, Plane, Plug, Receipt, RotateCcw, Scissors, Shirt, ShoppingBag, ShoppingCart, Smartphone,
  Sparkles, Stethoscope, Tag, Ticket, Train, TrendingUp, Tv, Utensils, Wallet, Wifi, Wine, Wrench, Droplet, Flame,
  Sofa, Shield, PiggyBank, Target, Rocket, Umbrella, Mountain, Star, Trophy, Club, Percent, Building2, Footprints,
  Glasses, Sandwich, Pizza, Beer, Popcorn, Cloud, Globe, Megaphone, Calendar, ArrowLeftRight, Store, Gem,
  type LucideIcon,
} from 'lucide-react';

/** Curated set used for categories, accounts and goals. Keys are stored in the database. */
export const ICONS: Record<string, LucideIcon> = {
  home: Home, sofa: Sofa, plug: Plug, lightbulb: Lightbulb, droplet: Droplet, flame: Flame, wifi: Wifi, building: Building2,
  hammer: Hammer, wrench: Wrench, shield: Shield, umbrella: Umbrella,
  cart: ShoppingCart, apple: Apple, utensils: Utensils, coffee: Coffee, sandwich: Sandwich, pizza: Pizza, beer: Beer, wine: Wine, cake: Cake,
  car: Car, bus: Bus, train: Train, fuel: Fuel, parking: ParkingCircle, bike: Bike, plane: Plane, footprints: Footprints,
  pill: Pill, stethoscope: Stethoscope, heart: Heart, glasses: Glasses, dumbbell: Dumbbell,
  shirt: Shirt, scissors: Scissors, sparkles: Sparkles, gem: Gem,
  gamepad: Gamepad2, cards: Club, film: Film, popcorn: Popcorn, ticket: Ticket, music: Music, book: BookOpen, mountain: Mountain,
  tv: Tv, cloud: Cloud, smartphone: Smartphone, laptop: Laptop, globe: Globe,
  briefcase: Briefcase, megaphone: Megaphone, store: Store,
  gift: Gift, handheart: HandHeart, paw: PawPrint, baby: Baby, graduation: GraduationCap,
  receipt: Receipt, landmark: Landmark, percent: Percent, creditcard: CreditCard, calendar: Calendar,
  wallet: Wallet, banknote: Banknote, coins: Coins, handcoins: HandCoins, refund: RotateCcw, trending: TrendingUp,
  piggy: PiggyBank, target: Target, rocket: Rocket, star: Star, trophy: Trophy, transfer: ArrowLeftRight,
  shopping: ShoppingBag, package: Package, tag: Tag,
};

export function Icon({ name, size = 20, strokeWidth = 2 }: { name?: string; size?: number; strokeWidth?: number }) {
  const C = (name && ICONS[name]) || Tag;
  return <C size={size} strokeWidth={strokeWidth} aria-hidden />;
}

export function IconPicker({ value, onPick }: { value: string; onPick: (k: string) => void }) {
  return (
    <div className="icon-grid" role="group" aria-label="Ícone">
      {Object.keys(ICONS).map((k) => (
        <button key={k} type="button" aria-label={k} aria-pressed={value === k} onClick={() => onPick(k)}>
          <Icon name={k} size={19} />
        </button>
      ))}
    </div>
  );
}
