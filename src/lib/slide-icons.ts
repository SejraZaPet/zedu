import {
  Sparkles, Star, Heart, Lightbulb, Brain, BookOpen, GraduationCap, Pencil, PenTool,
  Calculator, Ruler, Globe, Map, Compass, Microscope, FlaskConical, Atom, Dna, Leaf,
  Trees, Sun, Moon, CloudSun, CloudRain, Snowflake, Droplet, Flame, Wind, Mountain,
  Rocket, Plane, Car, Bike, Ship, Train, Clock, Timer, Calendar, Trophy, Medal, Award,
  Target, Flag, Users, User, MessageCircle, MessageSquare, Mic, Music, Play, Camera,
  Image as ImageIcon, Video, Palette, Brush, Puzzle, Gamepad2, Dices, Key, Lock, Unlock,
  Search, Eye, Check, X, AlertTriangle, Info, HelpCircle, ThumbsUp, ThumbsDown, Zap,
  Battery, Wifi, Cpu, Code, Database, Server, Smartphone, Laptop, Printer, Folder,
  FileText, ClipboardList, ListChecks, BarChart3, PieChart, TrendingUp, Coins, Euro,
  ShoppingCart, Building2, Home, School, Hospital, Church, Landmark, Scale, Gavel,
  Handshake, Hand, Footprints, Activity, Dumbbell, Apple, Carrot, Coffee, Utensils,
  Bug, Bird, Fish, Cat, Dog, Rabbit, type LucideIcon,
} from "lucide-react";

/** Allowlist ikon dostupných v editoru slidů (žádné dynamické importy). */
export const SLIDE_ICONS: Record<string, LucideIcon> = {
  Sparkles, Star, Heart, Lightbulb, Brain, BookOpen, GraduationCap, Pencil, PenTool,
  Calculator, Ruler, Globe, Map, Compass, Microscope, FlaskConical, Atom, Dna, Leaf,
  Trees, Sun, Moon, CloudSun, CloudRain, Snowflake, Droplet, Flame, Wind, Mountain,
  Rocket, Plane, Car, Bike, Ship, Train, Clock, Timer, Calendar, Trophy, Medal, Award,
  Target, Flag, Users, User, MessageCircle, MessageSquare, Mic, Music, Play, Camera,
  ImageIcon, Video, Palette, Brush, Puzzle, Gamepad2, Dices, Key, Lock, Unlock,
  Search, Eye, Check, X, AlertTriangle, Info, HelpCircle, ThumbsUp, ThumbsDown, Zap,
  Battery, Wifi, Cpu, Code, Database, Server, Smartphone, Laptop, Printer, Folder,
  FileText, ClipboardList, ListChecks, BarChart3, PieChart, TrendingUp, Coins, Euro,
  ShoppingCart, Building2, Home, School, Hospital, Church, Landmark, Scale, Gavel,
  Handshake, Hand, Footprints, Activity, Dumbbell, Apple, Carrot, Coffee, Utensils,
  Bug, Bird, Fish, Cat, Dog, Rabbit,
};

export const SLIDE_ICON_NAMES = Object.keys(SLIDE_ICONS);

export function getSlideIcon(name?: string | null): LucideIcon | null {
  if (!name) return null;
  return SLIDE_ICONS[name] ?? null;
}
