interface BrandLogoProps {
  iconSize?: string   // tailwind h-* class for the icon
  textSize?: string   // tailwind text-* class for the name
  className?: string
}

export function BrandLogo({ iconSize = 'h-8', textSize = 'text-base', className = '' }: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="CooVex" className={`${iconSize} w-auto object-contain flex-shrink-0`} />
      <span className={`font-bold ${textSize} tracking-tight`}>
        <span style={{ background: 'linear-gradient(135deg, #3b82f6, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Coo</span>
        <span style={{ background: 'linear-gradient(135deg, #2563eb, #84cc16)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Vex</span>
      </span>
    </div>
  )
}
