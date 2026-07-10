import { Loader } from 'lucide-react'

const variantStyles = {
  primary: {
    text: 'text-[#7C3AED]',
    solid: 'bg-[#7C3AED]',
    accent: 'bg-[#6D28D9]',
    border: 'border-[#7C3AED]/20',
    iconColor: 'text-white',
    labelHover: 'group-hover:bg-[#7C3AED]/5',
    iconHover: 'group-hover:bg-[#6D28D9]',
    shadow: 'shadow-purple-500/20',
  },
  secondary: {
    text: 'text-[#2563EB]',
    solid: 'bg-[#2563EB]',
    accent: 'bg-[#1E3A8A]',
    border: 'border-[#2563EB]/20',
    iconColor: 'text-white',
    labelHover: 'group-hover:bg-[#2563EB]/5',
    iconHover: 'group-hover:bg-[#1E3A8A]',
    shadow: 'shadow-blue-500/20',
  },
  ghost: {
    text: 'text-[#6B6560]',
    solid: 'bg-[#E8E4DD]',
    accent: 'bg-[#D9D1C7]',
    border: 'border-[#6B6560]/20',
    iconColor: 'text-[#1A1A1A]',
    labelHover: 'group-hover:bg-[#6B6560]/5',
    iconHover: 'group-hover:bg-[#D9D1C7]',
    shadow: 'shadow-slate-200/40',
  },
  danger: {
    text: 'text-red-500',
    solid: 'bg-red-500',
    accent: 'bg-red-600',
    border: 'border-red-500/20',
    iconColor: 'text-white',
    labelHover: 'group-hover:bg-red-500/5',
    iconHover: 'group-hover:bg-red-600',
    shadow: 'shadow-red-500/20',
  },
}

const transparentStyles = {
  primary: {
    solid: 'bg-[#7C3AED]/70',
    accent: 'bg-[#6D28D9]/80',
  },
  secondary: {
    solid: 'bg-[#2563EB]/70',
    accent: 'bg-[#1E3A8A]/80',
  },
  ghost: {
    solid: 'bg-[#E8E4DD]/80',
    accent: 'bg-[#D9D1C7]/90',
  },
  danger: {
    solid: 'bg-red-500/70',
    accent: 'bg-red-600/80',
  },
}

export const Button = ({
  label,
  icon: Icon,
  onClick,
  type = 'button',
  disabled = false,
  variant = 'primary',
  transparent = false,
  className = '',
  iconPosition = 'right',
  loading = false,
  iconClassName = '',
  iconColorClassName = '',
}) => {
  const styles = variantStyles[variant] || variantStyles.primary
  const transparentStyle = transparentStyles[variant] || transparentStyles.primary
  const isGhost = variant === 'ghost'
  const isTransparent = transparent
  const showingIconOnLeft = iconPosition === 'left'

  const baseClasses = [
    'group relative inline-flex items-center overflow-hidden rounded-full border text-sm font-medium transition-all duration-200 hover:scale-[1.02] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60',
    styles.border,
    isTransparent ? 'bg-transparent shadow-none' : 'bg-white shadow-sm',
    isGhost ? 'shadow-sm' : styles.shadow,
    className,
  ].join(' ')

  const leftHalfClasses = [
    'flex items-center justify-center px-4 py-2.5',
    isTransparent ? 'bg-transparent' : 'bg-white',
    styles.text,
    styles.labelHover,
    showingIconOnLeft ? 'rounded-r-full' : 'rounded-l-full',
  ].join(' ')

  const rightHalfClasses = [
    'flex items-center justify-center px-3 py-2.5',
    isTransparent ? transparentStyle.solid : styles.solid,
    isGhost ? styles.iconColor : 'text-white',
    styles.iconHover,
    iconClassName,
    showingIconOnLeft ? 'rounded-l-full' : 'rounded-r-full',
  ].join(' ')

  const leftContentClasses = showingIconOnLeft ? 'justify-end' : 'justify-start'
  const rightContentClasses = showingIconOnLeft ? 'justify-start' : 'justify-end'

  const iconNode = loading ? (
    <Loader size={16} className={`animate-spin ${iconColorClassName || (isGhost ? styles.iconColor : 'text-white')}`} />
  ) : Icon ? (
    <Icon size={16} className={iconColorClassName || (isGhost ? styles.iconColor : 'text-white')} />
  ) : null

  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={baseClasses}>
      <span className="relative flex h-full items-stretch">
        <span className={`relative flex items-center ${leftContentClasses} ${leftHalfClasses}`} style={{ clipPath: 'polygon(0 0, 100% 0, 82% 100%, 0 100%)' }}>
          <span className="whitespace-nowrap px-2 text-sm font-medium">{label}</span>
        </span>
        <span className={`relative flex items-center ${rightContentClasses} ${rightHalfClasses}`} style={{ clipPath: 'polygon(18% 0, 100% 0, 100% 100%, 0 100%)' }}>
          {iconNode}
        </span>
      </span>
    </button>
  )
}
