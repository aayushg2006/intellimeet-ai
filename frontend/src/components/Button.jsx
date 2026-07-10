import { Loader } from 'lucide-react'

const variantStyles = {
  primary: {
    base: 'border-[#7C3AED] bg-[#7C3AED] text-white shadow-purple-500/20 hover:bg-[#6D28D9]',
    subtle: 'border-[#7C3AED]/20 bg-white text-[#7C3AED] hover:bg-[#7C3AED]/5',
  },
  secondary: {
    base: 'border-[#2563EB] bg-[#2563EB] text-white shadow-blue-500/20 hover:bg-[#1E3A8A]',
    subtle: 'border-[#2563EB]/20 bg-white text-[#2563EB] hover:bg-[#2563EB]/5',
  },
  ghost: {
    base: 'border-[#E8E4DD] bg-white text-[#6B6560] shadow-slate-200/40 hover:bg-[#F5F2EE]',
    subtle: 'border-[#E8E4DD] bg-[#FAF9F7] text-[#6B6560] hover:bg-[#F5F2EE]',
  },
  danger: {
    base: 'border-red-500 bg-red-500 text-white shadow-red-500/20 hover:bg-red-600',
    subtle: 'border-red-500/20 bg-white text-red-500 hover:bg-red-500/5',
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
  const isGhost = variant === 'ghost'
  const isTransparent = transparent

  const baseClasses = [
    'inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:shadow-sm disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60',
    isTransparent ? 'border-transparent bg-transparent shadow-none' : styles[isGhost ? 'subtle' : 'base'],
    className,
  ].join(' ')

  const iconNode = loading ? (
    <Loader size={16} className={`animate-spin ${iconClassName} ${iconColorClassName || (variant === 'ghost' ? 'text-[#6B6560]' : 'text-current')}`} />
  ) : Icon ? (
    <Icon size={16} className={`${iconClassName} ${iconColorClassName || (variant === 'ghost' ? 'text-[#6B6560]' : 'text-current')}`} />
  ) : null

  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={baseClasses}>
      {iconPosition === 'left' && iconNode}
      <span className="whitespace-nowrap">{label}</span>
      {iconPosition === 'right' && iconNode}
    </button>
  )
}
