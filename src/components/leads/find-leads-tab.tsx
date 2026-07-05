'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

// ─── 500 Preset Keywords ──────────────────────────────────────────────────────

const KEYWORD_CATEGORIES: { name: string; emoji: string; keywords: string[] }[] = [
  {
    name: 'Marketing & Ads',
    emoji: '📣',
    keywords: [
      'Marketing Agency', 'Digital Marketing Agency', 'SEO Agency', 'Social Media Agency',
      'Content Marketing Agency', 'Email Marketing Agency', 'Advertising Agency', 'PR Agency',
      'Media Agency', 'Influencer Agency', 'Affiliate Marketing Company', 'Performance Marketing Agency',
      'Growth Hacking Agency', 'Brand Strategy Agency', 'Lead Generation Agency',
    ],
  },
  {
    name: 'Design & Creative',
    emoji: '🎨',
    keywords: [
      'Graphic Design Studio', 'Branding Agency', 'Web Design Agency', 'UX Design Agency',
      'Video Production Company', 'Photography Studio', 'Animation Studio', 'Motion Graphics Studio',
      'Logo Design Studio', 'Packaging Design Company', 'Print Design Studio',
    ],
  },
  {
    name: 'Technology & IT',
    emoji: '💻',
    keywords: [
      'Web Development Company', 'Mobile App Development', 'Software Development Company',
      'IT Consulting', 'IT Company', 'Cybersecurity Company', 'SaaS Company',
      'E-commerce Company', 'Cloud Services', 'Data Analytics Company', 'AI Company',
      'Fintech Company', 'Blockchain Company', 'Game Development Studio',
      'CRM Software Company', 'ERP Software Company', 'HR Software Company',
      'Help Desk Service', 'Network Installation', 'Server Hosting', 'VPN Service',
      'IoT Company', 'Robotics Company', 'Drone Company', 'AR VR Company',
    ],
  },
  {
    name: 'Education',
    emoji: '🎓',
    keywords: [
      'Kindergarten', 'Primary School', 'Secondary School', 'High School', 'College',
      'University', 'Coaching Center', 'Tutoring Center', 'Language School',
      'English Language School', 'Driving School', 'Vocational Training Center',
      'Computer Training Center', 'Online Learning Platform', 'Music School',
      'Dance Academy', 'Art School', 'Sports Academy', 'Martial Arts School',
      'Swimming Academy', 'Montessori School', 'Test Prep Center',
    ],
  },
  {
    name: 'Healthcare',
    emoji: '🏥',
    keywords: [
      'Hospital', 'Clinic', 'General Clinic', 'Dental Clinic', 'Eye Clinic',
      'Skin Clinic', 'Pediatric Clinic', 'Orthopedic Clinic', 'Maternity Clinic',
      'Mental Health Clinic', 'Physiotherapy Center', 'Pharmacy', 'Medical Laboratory',
      'Diagnostic Center', 'Nursing Home', 'Rehabilitation Center', 'Cancer Center',
      'Cardiology Clinic', 'Neurology Clinic', 'Psychiatry Clinic',
      'Ayurvedic Clinic', 'Homeopathic Clinic', 'Veterinary Clinic',
      'Animal Hospital', 'Nutrition Clinic', 'Weight Loss Clinic',
    ],
  },
  {
    name: 'Food & Beverage',
    emoji: '🍽️',
    keywords: [
      'Restaurant', 'Cafe', 'Coffee Shop', 'Fast Food Restaurant', 'Bakery',
      'Catering Service', 'Food Delivery', 'Pizza Restaurant', 'Chinese Restaurant',
      'Indian Restaurant', 'Seafood Restaurant', 'Buffet Restaurant', 'Cloud Kitchen',
      'Food Truck', 'Juice Bar', 'Ice Cream Shop', 'Sweet Shop', 'Confectionery',
      'Brewery', 'Winery', 'Tea House', 'Sushi Restaurant', 'Vegan Restaurant',
      'Street Food Stall',
    ],
  },
  {
    name: 'Hospitality & Travel',
    emoji: '✈️',
    keywords: [
      'Hotel', 'Resort', 'Motel', 'Guest House', 'Hostel', 'Bed and Breakfast',
      'Spa', 'Wellness Center', 'Travel Agency', 'Tour Operator', 'Airlines',
      'Car Rental', 'Cruise Company', 'Camping Site', 'Eco Lodge',
      'Adventure Tourism', 'Safari Company', 'Visa Consultancy',
    ],
  },
  {
    name: 'Fitness & Wellness',
    emoji: '💪',
    keywords: [
      'Gym', 'Fitness Center', 'Yoga Studio', 'Meditation Center', 'Pilates Studio',
      'CrossFit Gym', 'Personal Trainer', 'Nutritionist', 'Sports Club',
      'Swimming Pool', 'Golf Club', 'Tennis Club', 'Cycling Studio', 'Climbing Gym',
    ],
  },
  {
    name: 'Retail',
    emoji: '🛍️',
    keywords: [
      'Grocery Store', 'Supermarket', 'Hypermarket', 'Clothing Store', 'Fashion Store',
      'Electronics Store', 'Mobile Phone Shop', 'Computer Shop', 'Furniture Store',
      'Home Decor Store', 'Jewelry Store', 'Shoe Store', 'Book Store', 'Sports Store',
      'Toy Store', 'Baby Store', 'Pet Shop', 'Florist', 'Gift Shop',
      'Stationery Store', 'Hardware Store', 'Tools Shop', 'Appliance Store',
      'Bicycle Shop', 'Musical Instruments Shop', 'Art Supplies Store',
      'Optical Store', 'Watch Store', 'Cosmetics Store', 'Perfume Shop',
      'Organic Store', 'Second-Hand Store',
    ],
  },
  {
    name: 'Professional Services',
    emoji: '💼',
    keywords: [
      'Law Firm', 'Accounting Firm', 'Financial Advisor', 'Tax Consultant',
      'HR Consulting', 'Business Consulting', 'Management Consulting',
      'Engineering Firm', 'Architecture Firm', 'Interior Design Studio',
      'Environmental Consulting', 'Recruitment Agency', 'Translation Agency',
      'Research Company', 'Survey Company', 'Notary Office', 'Patent Agency',
      'Customs Broker', 'Event Management Company', 'Wedding Planner',
    ],
  },
  {
    name: 'Finance',
    emoji: '💰',
    keywords: [
      'Bank', 'Insurance Company', 'Investment Firm', 'Microfinance Company',
      'Stock Broker', 'Forex Exchange', 'Loan Company', 'Credit Union',
      'Venture Capital Firm', 'Private Equity', 'Mortgage Company',
      'Leasing Company', 'Payment Gateway', 'Money Transfer Service',
      'Crypto Exchange', 'Accounting Software Company',
    ],
  },
  {
    name: 'Construction & Real Estate',
    emoji: '🏗️',
    keywords: [
      'Construction Company', 'Real Estate Agency', 'Property Developer',
      'Plumbing Service', 'Electrical Service', 'HVAC Service', 'Painting Service',
      'Landscaping Service', 'Roofing Company', 'Flooring Company',
      'Glass Company', 'Security System Installer', 'Elevator Company',
      'Cleaning Service', 'Facility Management', 'Property Management',
      'Land Surveyor', 'Civil Engineering Company',
    ],
  },
  {
    name: 'Auto',
    emoji: '🚗',
    keywords: [
      'Car Dealership', 'Auto Repair Shop', 'Car Wash', 'Tire Shop',
      'Auto Parts Store', 'Motorcycle Dealer', 'Car Rental', 'Towing Service',
      'Auto Glass Repair', 'Vehicle Inspection', 'Auto Detailing',
      'Truck Dealership', 'Electric Vehicle Dealer', 'Bicycle Repair Shop',
    ],
  },
  {
    name: 'Beauty & Care',
    emoji: '💅',
    keywords: [
      'Beauty Salon', 'Hair Salon', 'Barber Shop', 'Nail Salon',
      'Makeup Artist', 'Tattoo Studio', 'Massage Center', 'Skincare Clinic',
      'Laser Clinic', 'Plastic Surgery Clinic', 'Tanning Studio',
      'Threading Salon', 'Waxing Salon', 'Eyebrow Studio',
    ],
  },
  {
    name: 'Media & Entertainment',
    emoji: '🎬',
    keywords: [
      'Newspaper', 'Magazine', 'Online News Portal', 'Radio Station', 'TV Channel',
      'Podcast Studio', 'Music Production Studio', 'Publishing House',
      'Print Shop', 'Sign Maker', 'Advertising Billboard Company',
      'Film Production Company', 'Music Label', 'Talent Agency', 'Model Agency',
      'Sports Event Organizer', 'Exhibition Company', 'Conference Center',
      'Wedding Hall', 'Party Venue',
    ],
  },
  {
    name: 'Logistics & Transport',
    emoji: '🚚',
    keywords: [
      'Courier Service', 'Freight Company', 'Shipping Company', 'Logistics Company',
      'Warehousing', 'Moving Company', 'Truck Rental', 'Bus Company',
      'Taxi Company', 'Last Mile Delivery', 'Cold Chain Logistics',
      'Import Export Company', 'Port Services', 'Air Freight Company',
    ],
  },
  {
    name: 'Manufacturing',
    emoji: '🏭',
    keywords: [
      'Garment Factory', 'Textile Factory', 'Food Processing Plant',
      'Furniture Manufacturer', 'Electronics Manufacturer', 'Pharmaceutical Manufacturer',
      'Plastic Manufacturer', 'Steel Company', 'Aluminum Company', 'Paper Company',
      'Chemical Company', 'Packaging Company', 'Printing Company',
      'Leather Goods Manufacturer', 'Shoe Manufacturer', 'Cosmetics Manufacturer',
      'Agriculture Equipment Manufacturer', 'Auto Parts Manufacturer',
    ],
  },
  {
    name: 'Agriculture',
    emoji: '🌾',
    keywords: [
      'Agribusiness', 'Farm', 'Agricultural Supplier', 'Fertilizer Company',
      'Pesticide Company', 'Seed Company', 'Irrigation Company', 'Poultry Farm',
      'Dairy Farm', 'Fishery', 'Organic Farm', 'Tea Plantation', 'Coffee Plantation',
      'Rubber Plantation', 'Flower Farm', 'Aquaculture', 'Beekeeping',
    ],
  },
  {
    name: 'Energy & Environment',
    emoji: '☀️',
    keywords: [
      'Solar Energy Company', 'Wind Energy Company', 'Renewable Energy Company',
      'Electric Company', 'Gas Company', 'Oil Company', 'Water Treatment Company',
      'Waste Management', 'Recycling Company', 'Environmental Consulting',
    ],
  },
  {
    name: 'NGO & Community',
    emoji: '🤝',
    keywords: [
      'NGO', 'Non-profit Organization', 'Charity Foundation', 'Religious Organization',
      'Sports Club', 'Community Organization', 'Trade Union',
      'Industry Association', 'Chamber of Commerce', 'Social Enterprise',
      'Volunteer Organization', 'Youth Organization',
    ],
  },
  {
    name: 'E-commerce & Online',
    emoji: '🌐',
    keywords: [
      'Online Store', 'E-commerce Store', 'Online Marketplace', 'Dropshipping Business',
      'Wholesale Business', 'Import Business', 'Export Business',
      'Subscription Box Service', 'Online Pharmacy', 'Online Grocery',
      'Online Fashion Store', 'Digital Products Store',
    ],
  },
  {
    name: 'Workspace & Office',
    emoji: '🏢',
    keywords: [
      'Co-working Space', 'Business Center', 'Virtual Office', 'Serviced Office',
      'Startup Incubator', 'Tech Hub', 'Accelerator Program',
      'Business Incubator', 'Innovation Lab',
    ],
  },
]

const ALL_KEYWORDS: { keyword: string; category: string }[] = KEYWORD_CATEGORIES.flatMap(cat =>
  cat.keywords.map(kw => ({ keyword: kw, category: cat.name }))
)

// ─── Countries & Cities ───────────────────────────────────────────────────────

const COUNTRIES = [
  'All Countries',
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria',
  'Azerbaijan', 'Bangladesh', 'Belgium', 'Brazil', 'Bulgaria', 'Cambodia',
  'Canada', 'Chile', 'China', 'Colombia', 'Croatia', 'Czech Republic',
  'Denmark', 'Egypt', 'Ethiopia', 'Finland', 'France', 'Georgia',
  'Germany', 'Ghana', 'Greece', 'Hungary', 'India', 'Indonesia',
  'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Japan',
  'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Malaysia', 'Mexico',
  'Morocco', 'Myanmar', 'Nepal', 'Netherlands', 'New Zealand', 'Nigeria',
  'Norway', 'Pakistan', 'Peru', 'Philippines', 'Poland', 'Portugal',
  'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Serbia', 'Singapore',
  'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland',
  'Taiwan', 'Tanzania', 'Thailand', 'Turkey', 'Ukraine', 'United Arab Emirates',
  'United Kingdom', 'United States', 'Uzbekistan', 'Venezuela', 'Vietnam',
  'Yemen', 'Zimbabwe',
]

const CITIES: Record<string, string[]> = {
  'All Countries': ['All Cities'],
  Bangladesh: ['All Cities', 'Dhaka', 'Chattogram', 'Sylhet', 'Rajshahi', 'Khulna', 'Barishal', 'Mymensingh', 'Comilla', 'Gazipur', 'Narayanganj'],
  India: ['All Cities', 'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat'],
  'United States': ['All Cities', 'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Seattle', 'Miami', 'Atlanta', 'Boston'],
  'United Kingdom': ['All Cities', 'London', 'Birmingham', 'Manchester', 'Leeds', 'Glasgow', 'Liverpool', 'Bristol', 'Edinburgh', 'Sheffield', 'Cardiff'],
  Australia: ['All Cities', 'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Canberra', 'Newcastle', 'Hobart'],
  Canada: ['All Cities', 'Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa', 'Winnipeg', 'Quebec City', 'Hamilton'],
  Germany: ['All Cities', 'Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Dusseldorf', 'Leipzig', 'Dresden'],
  France: ['All Cities', 'Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Bordeaux', 'Strasbourg', 'Lille'],
  Pakistan: ['All Cities', 'Karachi', 'Lahore', 'Islamabad', 'Faisalabad', 'Rawalpindi', 'Peshawar', 'Multan', 'Hyderabad'],
  'Saudi Arabia': ['All Cities', 'Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Khobar', 'Tabuk', 'Abha'],
  'United Arab Emirates': ['All Cities', 'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah'],
  Nigeria: ['All Cities', 'Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt', 'Benin City', 'Kaduna'],
  China: ['All Cities', 'Beijing', 'Shanghai', 'Shenzhen', 'Guangzhou', 'Chengdu', 'Wuhan', 'Hangzhou', 'Tianjin', 'Nanjing'],
  Japan: ['All Cities', 'Tokyo', 'Osaka', 'Yokohama', 'Nagoya', 'Sapporo', 'Kobe', 'Kyoto', 'Fukuoka'],
  Brazil: ['All Cities', 'Sao Paulo', 'Rio de Janeiro', 'Brasilia', 'Salvador', 'Fortaleza', 'Belo Horizonte', 'Manaus'],
  Indonesia: ['All Cities', 'Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Bekasi', 'Tangerang', 'Semarang', 'Makassar'],
  Malaysia: ['All Cities', 'Kuala Lumpur', 'Johor Bahru', 'Penang', 'Ipoh', 'Shah Alam', 'Petaling Jaya', 'Kota Kinabalu'],
  Philippines: ['All Cities', 'Manila', 'Quezon City', 'Davao', 'Cebu City', 'Zamboanga', 'Antipolo', 'Taguig'],
  Thailand: ['All Cities', 'Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya', 'Nonthaburi', 'Udon Thani'],
  Egypt: ['All Cities', 'Cairo', 'Alexandria', 'Giza', 'Luxor', 'Aswan', 'Port Said', 'Suez'],
  Kenya: ['All Cities', 'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret'],
  Ghana: ['All Cities', 'Accra', 'Kumasi', 'Tamale', 'Sekondi-Takoradi', 'Ashaiman'],
}

const DEFAULT_CITIES = ['All Cities']

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScrapedLead {
  id: string | null
  keyword: string
  country: string | null
  city: string | null
  google_rank_title: string | null
  website_url: string
  domain: string
  scrapping_date: string | null
  enrichment: EnrichmentData | null
}

interface EnrichmentData {
  domain: string
  emails: string[]
  phones: string[]
  address: string | null
  brand_name: string | null
  title: string | null
  technologies: string[]
  products_services: string[]
}

// ─── Keyword Autocomplete ─────────────────────────────────────────────────────

function KeywordInput({
  selected, onSelect, onClear,
}: { selected: string | null; onSelect: (kw: string) => void; onClear: () => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(() => {
    if (!query.trim()) return ALL_KEYWORDS.slice(0, 8)
    const q = query.toLowerCase()
    return ALL_KEYWORDS.filter(k => k.keyword.toLowerCase().includes(q)).slice(0, 10)
  }, [query])

  useEffect(() => {
    setHighlighted(0)
  }, [query])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function pick(kw: string) {
    onSelect(kw)
    setQuery('')
    setOpen(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (suggestions[highlighted]) pick(suggestions[highlighted].keyword) }
    else if (e.key === 'Escape') setOpen(false)
  }

  const catEmoji = (cat: string) => KEYWORD_CATEGORIES.find(c => c.name === cat)?.emoji ?? '🔑'

  if (selected) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-violet-600/15 border border-violet-600/40 rounded-xl px-4 py-2.5 flex-1">
          <span className="text-violet-300 font-semibold text-sm">{selected}</span>
        </div>
        <button
          onClick={() => { onClear(); setTimeout(() => inputRef.current?.focus(), 50) }}
          className="text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600 rounded-xl px-3 py-2.5 text-xs transition-colors">
          Change
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder="Type a keyword — e.g. Marketing Agency, Hospital, Restaurant..."
          autoComplete="off"
          className="w-full pl-10 pr-4 py-3 bg-slate-800/60 border border-slate-700 focus:border-violet-500 text-slate-200 text-sm rounded-xl focus:outline-none placeholder-slate-500 transition-colors"
        />
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50 max-h-64 overflow-y-auto">
          {!query && (
            <div className="px-3 py-2 border-b border-slate-800">
              <span className="text-xs text-slate-600">Popular keywords</span>
            </div>
          )}
          {suggestions.map(({ keyword, category }, i) => (
            <button
              key={keyword}
              onMouseDown={() => pick(keyword)}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                highlighted === i ? 'bg-violet-600/20' : 'hover:bg-slate-800'
              }`}>
              <span className="text-base shrink-0">{catEmoji(category)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 text-sm font-medium">{keyword}</p>
                <p className="text-slate-500 text-xs">{category}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Searchable Select Dropdown ───────────────────────────────────────────────

function SelectDropdown({
  options, value, onChange, placeholder = 'Select...',
}: { options: string[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return q ? options.filter(o => o.toLowerCase().includes(q)) : options
  }, [query, options])

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery('')
      }
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  function pick(v: string) {
    onChange(v); setOpen(false); setQuery('')
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="w-full flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-700 hover:border-slate-600 focus:border-violet-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl transition-colors text-left">
        <span className={value ? 'text-slate-200' : 'text-slate-500'}>{value || placeholder}</span>
        <svg className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-800">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 focus:border-violet-500 text-slate-200 text-xs rounded-lg focus:outline-none placeholder-slate-500"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-slate-600 text-xs text-center py-4">No results</p>
            )}
            {filtered.map(opt => (
              <button
                key={opt}
                onMouseDown={() => pick(opt)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  value === opt
                    ? 'bg-violet-600/20 text-violet-300 font-medium'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Lead Row ─────────────────────────────────────────────────────────────────

function LeadRow({
  lead, checked, onToggle, onEnrich,
}: {
  lead: ScrapedLead
  checked: boolean
  onToggle: () => void
  onEnrich: (enrichment: EnrichmentData) => void
}) {
  const [enriching, setEnriching] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const e = lead.enrichment

  async function handleEnrich() {
    setEnriching(true)
    try {
      const res = await fetch('/api/leads/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: lead.domain, website_url: lead.website_url }),
      })
      const data = await res.json()
      if (data.enrichment) {
        onEnrich(data.enrichment)
        setExpanded(true)
        toast.success('Lead enriched!')
      } else {
        toast.error(data.error ?? 'Enrichment failed')
      }
    } catch {
      toast.error('Network error')
    }
    setEnriching(false)
  }

  const hasContact = (e?.emails?.length ?? 0) > 0 || (e?.phones?.length ?? 0) > 0
  const locationStr = [
    lead.city && lead.city !== 'All Cities' ? lead.city : '',
    lead.country && lead.country !== 'All Countries' ? lead.country : '',
  ].filter(Boolean).join(', ')

  return (
    <div className={`border-b border-slate-800 last:border-0 transition-colors ${checked ? 'bg-violet-950/15' : 'hover:bg-slate-800/20'}`}>
      <div className="flex items-start gap-3 px-5 py-3.5">
        <button onClick={onToggle} className="shrink-0 mt-0.5">
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
            checked ? 'bg-violet-600 border-violet-600' : 'border-slate-600 bg-transparent'
          }`}>
            {checked && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 12l5 5L20 7"/></svg>}
          </div>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-violet-400 text-xs font-medium bg-violet-950/40 border border-violet-800/30 px-2 py-0.5 rounded-full">
              🌐 {lead.domain}
            </span>
            {locationStr && <span className="text-slate-500 text-xs">📍 {locationStr}</span>}
            {lead.scrapping_date && <span className="text-slate-600 text-xs">{lead.scrapping_date}</span>}
            {hasContact && (
              <span className="text-emerald-400 text-xs bg-emerald-950/30 border border-emerald-800/30 px-2 py-0.5 rounded-full">
                ✓ Contact
              </span>
            )}
          </div>

          <p className="text-slate-200 text-sm font-medium leading-snug">{lead.google_rank_title || lead.domain}</p>

          {e && (
            <div className="mt-2 space-y-1.5">
              {e.emails && e.emails.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {e.emails.slice(0, 3).map(email => (
                    <button key={email} onClick={async () => { await navigator.clipboard.writeText(email); toast.success('Copied!') }}
                      className="flex items-center gap-1 text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-800/30 px-2 py-0.5 rounded-lg hover:bg-emerald-900/30 transition-colors">
                      ✉ {email}
                    </button>
                  ))}
                </div>
              )}
              {e.phones && e.phones.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {e.phones.slice(0, 2).map(ph => (
                    <span key={ph} className="text-xs text-blue-300 bg-blue-950/30 border border-blue-800/30 px-2 py-0.5 rounded-lg">📞 {ph}</span>
                  ))}
                </div>
              )}
              {expanded && (
                <div className="space-y-1 pt-0.5">
                  {e.address && <p className="text-xs text-slate-400">📍 {e.address}</p>}
                  {e.technologies && e.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {e.technologies.slice(0, 5).map(t => (
                        <span key={t} className="text-xs text-slate-500 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  )}
                  {e.products_services && e.products_services.length > 0 && (
                    <p className="text-xs text-slate-500">Services: {e.products_services.slice(0, 3).join(', ')}</p>
                  )}
                </div>
              )}
              {!expanded && (e.address || (e.technologies?.length ?? 0) > 0) && (
                <button onClick={() => setExpanded(true)} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                  Show more ↓
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a href={lead.website_url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1">
            Visit
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7M7 7h10v10"/></svg>
          </a>
          {!e ? (
            <button onClick={handleEnrich} disabled={enriching}
              className="text-xs text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 border border-blue-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-70 flex items-center gap-1.5 font-medium whitespace-nowrap">
              {enriching
                ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />AI Contact Finding…</>
                : <>✦ Find Contact With AI</>}
            </button>
          ) : (
            <button onClick={() => setExpanded(v => !v)}
              className="text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-800/30 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              ✓ Contact Found {expanded ? '↑' : '↓'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Scrape Activity Log ──────────────────────────────────────────────────────

interface LogEntry { icon: string; text: string; done: boolean; time: string }

function ScrapeLog({ loading, keyword, country, city, found }: {
  loading: boolean; keyword: string; country: string; city: string; found: number
}) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const ts = () => new Date().toLocaleTimeString('en', { hour12: false })
  const loc = [city && city !== 'All Cities' ? city : '', country && country !== 'All Countries' ? country : ''].filter(Boolean).join(', ') || 'worldwide'

  useEffect(() => {
    if (!loading) return
    setEntries([])
    const steps = [
      { delay: 0,     icon: '🔌', text: 'Starting Lead AI Engine...' },
      { delay: 1000,  icon: '🔎', text: `Searching for "${keyword}" in ${loc}...` },
      { delay: 3000,  icon: '📍', text: 'Querying Google Places database...' },
      { delay: 7000,  icon: '🌐', text: 'Fetching business website URLs...' },
      { delay: 13000, icon: '📋', text: 'Deduplicating — filtering already-seen results...' },
    ]
    const timers = steps.map(({ delay, icon, text }, i) =>
      setTimeout(() => {
        const t = ts()
        setEntries(prev => {
          const updated = prev.map((e, idx) => idx === prev.length - 1 ? { ...e, done: true } : e)
          return [...updated, { icon, text, done: i === steps.length - 1, time: t }]
        })
      }, delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [loading, keyword, loc])

  useEffect(() => {
    if (loading || entries.length === 0) return
    const t = ts()
    setEntries(prev => [
      ...prev.map(e => ({ ...e, done: true })),
      {
        icon: found > 0 ? '✅' : '🔍',
        text: found > 0 ? `Done! Found ${found} new leads` : 'No new leads found for this combination.',
        done: true,
        time: t,
      },
    ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  if (entries.length === 0) return null

  return (
    <div className="bg-slate-950 border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-900">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <span className="text-slate-500 text-xs font-mono ml-1">coovex — lead-scraper</span>
        {loading && (
          <span className="ml-auto flex items-center gap-1.5 text-violet-400 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />running
          </span>
        )}
      </div>
      <div className="p-4 space-y-2.5 font-mono min-h-[80px]">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-300">
            <span className="text-slate-600 text-xs shrink-0 tabular-nums mt-px">{entry.time}</span>
            <span className="shrink-0 mt-px w-4 text-center">
              {entry.done
                ? <span className="text-emerald-400 text-xs">✓</span>
                : <span className="inline-block w-3 h-3 border border-violet-500/40 border-t-violet-400 rounded-full animate-spin" />
              }
            </span>
            <span className={`text-xs leading-relaxed ${entry.done ? 'text-slate-400' : 'text-slate-100'}`}>
              {entry.icon} {entry.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type KeywordSession = {
  id?: string
  keyword: string
  country: string
  city: string
  leads: ScrapedLead[]
  savedAt: number
}

function makeSessionKey(keyword: string, country: string, city: string) {
  return `${keyword}||${country}||${city}`
}

export function FindLeadsTab({ businessId }: { businessId: string }) {
  const router = useRouter()
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null)
  const [selectedCountry, setSelectedCountry] = useState('All Countries')
  const [selectedCity, setSelectedCity] = useState('All Cities')
  const [sessions, setSessions] = useState<Record<string, KeywordSession>>({})
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loading, setLoading] = useState(false)
  const [findingMore, setFindingMore] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [bulkSaving, setBulkSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [enrichingCount, setEnrichingCount] = useState(0)
  const [enrichedTotal, setEnrichedTotal] = useState(0)

  const activeSession = activeKey ? (sessions[activeKey] ?? null) : null
  const leads = activeSession?.leads ?? []
  const searched = activeKey !== null
  const foundCount = leads.length

  // Load sessions from DB on mount
  useEffect(() => {
    fetch('/api/leads/sessions')
      .then(r => r.json())
      .then(({ sessions: loaded }) => {
        if (!Array.isArray(loaded) || loaded.length === 0) return
        const map: Record<string, KeywordSession> = {}
        for (const s of loaded) {
          const key = makeSessionKey(s.keyword, s.country, s.city)
          map[key] = s
        }
        setSessions(map)
        const latest = loaded[0]
        const latestKey = makeSessionKey(latest.keyword, latest.country, latest.city)
        setActiveKey(latestKey)
        setSelectedKeyword(latest.keyword)
        setSelectedCountry(latest.country || 'All Countries')
        setSelectedCity(latest.city || 'All Cities')
      })
      .catch(() => { /* ignore */ })
      .finally(() => setLoadingSessions(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId])

  const cities = CITIES[selectedCountry] ?? DEFAULT_CITIES

  function handleCountryChange(c: string) {
    setSelectedCountry(c)
    setSelectedCity('All Cities')
  }

  function switchToSession(key: string) {
    const s = sessions[key]
    if (!s) return
    setActiveKey(key)
    setSelectedKeyword(s.keyword)
    setSelectedCountry(s.country || 'All Countries')
    setSelectedCity(s.city || 'All Cities')
    setChecked(new Set())
    setMessage('')
    setEnrichingCount(0)
    setEnrichedTotal(0)
  }

  function removeSession(key: string) {
    const sessionId = sessions[key]?.id
    setSessions(prev => {
      const updated = { ...prev }
      delete updated[key]
      return updated
    })
    if (sessionId) {
      fetch(`/api/leads/sessions/${sessionId}`, { method: 'DELETE' }).catch(() => {})
    }
    if (activeKey === key) {
      const remaining = Object.keys(sessions).filter(k => k !== key)
      if (remaining.length > 0) {
        const next = remaining.sort((a, b) => (sessions[b].savedAt ?? 0) - (sessions[a].savedAt ?? 0))[0]
        switchToSession(next)
      } else {
        setActiveKey(null)
        setSelectedKeyword(null)
        setChecked(new Set())
      }
    }
  }

  async function saveSessionToDB(key: string, updatedSessions: Record<string, KeywordSession>) {
    const s = updatedSessions[key]
    if (!s) return
    const leadIds = s.leads.map(l => l.id).filter(Boolean)
    try {
      const res = await fetch('/api/leads/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: s.keyword,
          country: s.country,
          city: s.city,
          lead_ids: leadIds,
        }),
      })
      const data = await res.json()
      if (data.id && !s.id) {
        setSessions(prev => prev[key] ? { ...prev, [key]: { ...prev[key], id: data.id } } : prev)
      }
    } catch { /* ignore */ }
  }

  async function autoEnrichAll(newLeads: ScrapedLead[], sessionKey: string) {
    if (newLeads.length === 0) return
    const CONCURRENCY = 3
    setEnrichingCount(c => c + newLeads.length)

    async function enrichOne(lead: ScrapedLead) {
      if (lead.enrichment) { setEnrichedTotal(d => d + 1); return }
      try {
        const res = await fetch('/api/leads/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: lead.domain, website_url: lead.website_url }),
        })
        const data = await res.json()
        if (data.enrichment) {
          setSessions(prev => {
            if (!prev[sessionKey]) return prev
            const updatedLeads = prev[sessionKey].leads.map(l =>
              l.website_url === lead.website_url ? { ...l, enrichment: data.enrichment } : l
            )
            return { ...prev, [sessionKey]: { ...prev[sessionKey], leads: updatedLeads } }
          })
        }
      } catch { /* ignore */ }
      setEnrichedTotal(d => d + 1)
    }

    for (let i = 0; i < newLeads.length; i += CONCURRENCY) {
      await Promise.all(newLeads.slice(i, i + CONCURRENCY).map(l => enrichOne(l)))
    }
    setEnrichingCount(0)
  }

  async function handleSearch() {
    if (!selectedKeyword) { toast.error('Please select a keyword'); return }
    const key = makeSessionKey(selectedKeyword, selectedCountry, selectedCity)
    setActiveKey(key)
    setLoading(true)
    setChecked(new Set())
    setMessage('')
    setEnrichingCount(0)
    setEnrichedTotal(0)
    setSessions(prev => ({
      ...prev,
      [key]: { keyword: selectedKeyword, country: selectedCountry, city: selectedCity, leads: [], savedAt: Date.now() },
    }))
    try {
      const res = await fetch('/api/leads/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: selectedKeyword,
          country: selectedCountry === 'All Countries' ? '' : selectedCountry,
          city: selectedCity === 'All Cities' ? '' : selectedCity,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Search failed'); setLoading(false); return }
      const newLeads: ScrapedLead[] = data.leads ?? []
      if (data.message) setMessage(data.message)
      setSessions(prev => {
        const updated = { ...prev, [key]: { ...prev[key], leads: newLeads, savedAt: Date.now() } }
        saveSessionToDB(key, updated)
        return updated
      })
      setLoading(false)
      autoEnrichAll(newLeads, key)
      return
    } catch { toast.error('Network error') }
    setLoading(false)
  }

  async function handleFindMore() {
    if (!activeKey || !selectedKeyword || findingMore) return
    const key = activeKey
    setFindingMore(true)
    setMessage('')
    try {
      const res = await fetch('/api/leads/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: selectedKeyword,
          country: selectedCountry === 'All Countries' ? '' : selectedCountry,
          city: selectedCity === 'All Cities' ? '' : selectedCity,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Search failed'); setFindingMore(false); return }
      const newLeads: ScrapedLead[] = data.leads ?? []
      if (newLeads.length === 0) {
        toast.error(data.message || 'No more new leads found.')
        setFindingMore(false)
        return
      }
      let fresh: ScrapedLead[] = []
      setSessions(prev => {
        const existing = prev[key]?.leads ?? []
        const existingUrls = new Set(existing.map(l => l.website_url))
        fresh = newLeads.filter(l => !existingUrls.has(l.website_url))
        const merged = [...existing, ...fresh]
        const updated = { ...prev, [key]: { ...prev[key], leads: merged, savedAt: Date.now() } }
        saveSessionToDB(key, updated)
        return updated
      })
      if (data.message) setMessage(data.message)
      setTimeout(() => autoEnrichAll(fresh, key), 0)
    } catch { toast.error('Network error') }
    setFindingMore(false)
  }

  function toggleCheck(websiteUrl: string) {
    setChecked(prev => { const n = new Set(prev); n.has(websiteUrl) ? n.delete(websiteUrl) : n.add(websiteUrl); return n })
  }

  function toggleAll() {
    if (checked.size === leads.length) setChecked(new Set())
    else setChecked(new Set(leads.map(l => l.website_url)))
  }

  function handleEnrich(websiteUrl: string, enrichment: EnrichmentData) {
    if (!activeKey) return
    setSessions(prev => {
      if (!prev[activeKey]) return prev
      const updatedLeads = prev[activeKey].leads.map(l =>
        l.website_url === websiteUrl ? { ...l, enrichment } : l
      )
      return { ...prev, [activeKey]: { ...prev[activeKey], leads: updatedLeads } }
    })
  }

  async function saveSelected() {
    const selectedLeads = leads.filter(l => checked.has(l.website_url))
    if (selectedLeads.length === 0) return
    setBulkSaving(true)
    try {
      const res = await fetch('/api/leads/save-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          leads: selectedLeads.map(l => ({
            scraped_lead_id: l.id,
            website_url: l.website_url,
            domain: l.domain,
            google_rank_title: l.google_rank_title,
            keyword: l.keyword,
            country: l.country,
            city: l.city,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Save failed'); return }
      toast.success(`${data.saved} lead${data.saved !== 1 ? 's' : ''} saved!${data.duplicates > 0 ? ` (${data.duplicates} already existed)` : ''}`)
      setChecked(new Set())
      if (data.saved > 0) router.refresh()
    } catch { toast.error('Network error') }
    finally { setBulkSaving(false) }
  }

  const sessionList = Object.entries(sessions).sort((a, b) => (b[1].savedAt ?? 0) - (a[1].savedAt ?? 0))

  return (
    <div className="space-y-5">
      {/* Search config */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Keyword</p>
          <KeywordInput
            selected={selectedKeyword}
            onSelect={setSelectedKeyword}
            onClear={() => setSelectedKeyword(null)}
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Location</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1.5 block">Country</label>
              <SelectDropdown
                options={COUNTRIES}
                value={selectedCountry}
                onChange={handleCountryChange}
                placeholder="All Countries"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1.5 block">City</label>
              <SelectDropdown
                options={cities}
                value={selectedCity}
                onChange={setSelectedCity}
                placeholder="All Cities"
              />
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-1.5">
            Select &ldquo;All Countries&rdquo; / &ldquo;All Cities&rdquo; to search worldwide. More specific = faster results.
          </p>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-800">
          <p className="text-xs text-slate-600">
            {selectedKeyword ? (
              <>
                <span className="text-slate-400 font-medium">{selectedKeyword}</span>
                {selectedCountry !== 'All Countries' && (
                  <> in <span className="text-slate-400">{[selectedCity !== 'All Cities' ? selectedCity : '', selectedCountry].filter(Boolean).join(', ')}</span></>
                )}
                {selectedCountry === 'All Countries' && ' · worldwide'}
              </>
            ) : 'Select a keyword above to start'}
          </p>
          <button
            onClick={handleSearch}
            disabled={loading || !selectedKeyword}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
            {loading
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Searching…</>
              : '🔎 Find Leads'}
          </button>
        </div>
      </div>

      {/* Keyword session tabs */}
      {sessionList.length > 0 && !loading && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sessionList.map(([key, session]) => (
            <button
              key={key}
              onClick={() => switchToSession(key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                activeKey === key
                  ? 'bg-violet-600/20 border-violet-600/50 text-violet-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
              }`}
            >
              <span className="max-w-[130px] truncate">{session.keyword}</span>
              {session.country !== 'All Countries' && (
                <span className={`text-[10px] ${activeKey === key ? 'text-violet-400/70' : 'text-slate-600'}`}>
                  {session.city !== 'All Cities' ? session.city : session.country}
                </span>
              )}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeKey === key ? 'bg-violet-600/30 text-violet-300' : 'bg-slate-800 text-slate-500'
              }`}>
                {session.leads.length}
              </span>
              <span
                role="button"
                onClick={e => { e.stopPropagation(); removeSession(key) }}
                className={`ml-0.5 leading-none hover:text-red-400 transition-colors cursor-pointer ${activeKey === key ? 'text-violet-400/50' : 'text-slate-600'}`}
              >
                ×
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Scrape activity log */}
      <ScrapeLog
        loading={loading}
        keyword={selectedKeyword ?? ''}
        country={selectedCountry}
        city={selectedCity}
        found={foundCount}
      />

      {/* Results */}
      {!loading && searched && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-800/40">
            <div>
              <p className="text-slate-300 text-sm font-medium">
                {leads.length > 0 ? `${leads.length} leads found` : 'No leads found'}
              </p>
              {enrichingCount > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${(enrichedTotal / enrichingCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-blue-400 shrink-0">
                    ⚡ Enriching {enrichedTotal}/{enrichingCount}
                  </span>
                </div>
              )}
              {enrichingCount === 0 && leads.length > 0 && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {leads.filter(l => l.enrichment).length} enriched · {leads.filter(l => (l.enrichment?.emails?.length ?? 0) > 0).length} with email
                </p>
              )}
              {message && <p className="text-amber-400 text-xs mt-0.5">⚠ {message}</p>}
            </div>
            <button
              onClick={handleFindMore}
              disabled={findingMore}
              className="flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 disabled:opacity-40 border border-violet-800/50 hover:border-violet-700/70 px-3 py-1.5 rounded-lg transition-colors"
            >
              {findingMore ? (
                <>
                  <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
                  </svg>
                  Finding…
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12l7-7 7 7"/>
                  </svg>
                  Find More
                </>
              )}
            </button>
          </div>

          {leads.length > 0 && (
            <>
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-800 bg-slate-800/20">
                <button onClick={toggleAll}
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                  <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center ${
                    checked.size === leads.length ? 'bg-violet-600 border-violet-600' : 'border-slate-500'
                  }`}>
                    {checked.size === leads.length && (
                      <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 12l5 5L20 7"/></svg>
                    )}
                  </div>
                  {checked.size === leads.length ? 'Deselect All' : 'Select All'}
                </button>
                {checked.size > 0 && (
                  <button onClick={saveSelected} disabled={bulkSaving}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                    {bulkSaving
                      ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                      : `💾 Save ${checked.size} Lead${checked.size !== 1 ? 's' : ''} to Pipeline`}
                  </button>
                )}
              </div>

              {leads.map((lead, i) => (
                <LeadRow
                  key={`${lead.domain}-${i}`}
                  lead={lead}
                  checked={checked.has(lead.website_url)}
                  onToggle={() => toggleCheck(lead.website_url)}
                  onEnrich={(enrichment) => handleEnrich(lead.website_url, enrichment)}
                />
              ))}

              <div className="px-5 py-4 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
                <p className="text-slate-600 text-xs">
                  💡 <strong className="text-slate-500">⚡ Enrich</strong> fetches email, phone, address & technologies · Select &amp; <strong className="text-slate-500">Save to Pipeline</strong> for follow-ups
                </p>
                <button
                  onClick={handleFindMore}
                  disabled={findingMore}
                  className="flex items-center gap-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 px-4 py-2 rounded-xl transition-colors shrink-0 ml-4"
                >
                  {findingMore ? (
                    <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Finding…</>
                  ) : (
                    <>+ Find More <span className="text-violet-300 font-normal">(10 credits)</span></>
                  )}
                </button>
              </div>
            </>
          )}

          {leads.length === 0 && (
            <div className="py-12 text-center px-6">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-slate-300 text-sm font-medium mb-1">No new leads found</p>
              <p className="text-slate-500 text-xs max-w-xs mx-auto">
                {message || 'All leads for this combination may have already been scraped, or no results exist for this keyword + location.'}
              </p>
              <button onClick={handleSearch} className="mt-4 text-xs text-violet-400 hover:text-violet-300 border border-violet-800/40 px-3 py-1.5 rounded-lg">
                Try again
              </button>
            </div>
          )}
        </div>
      )}

      {loadingSessions && !loading && !searched && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl py-14 text-center">
          <span className="inline-block w-6 h-6 border-2 border-violet-600/40 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-slate-500 text-xs mt-3">Loading your sessions…</p>
        </div>
      )}

      {!loadingSessions && !loading && !searched && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl py-14 text-center">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-slate-300 text-base font-semibold mb-1">Keyword Lead Scraper</p>
          <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
            Select a business keyword and location, then click Find Leads to pull real business websites from Google Places.
          </p>
          <div className="mt-5 flex items-center justify-center gap-4 text-xs text-slate-600 flex-wrap">
            <span>⚡ Enrich for contact info</span>
            <span>·</span>
            <span>💾 Save to pipeline</span>
            <span>·</span>
            <span>🗂 Data stored globally</span>
          </div>
        </div>
      )}
    </div>
  )
}
