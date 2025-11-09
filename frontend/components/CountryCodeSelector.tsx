'use client'

import { useState, useRef, useEffect, forwardRef } from 'react'
import { COUNTRY_CODES, CountryInfo } from '@/lib/countryCodesFull'

interface CountryCodeSelectorProps {
  value?: string
  defaultValue?: string
  countryIso?: string  // ISO code to help identify specific country when multiple share same code
  onChange?: (value: string) => void
  onCountrySelect?: (iso: string, code: string) => void  // Callback with both ISO and code
  name?: string
  className?: string
  disabled?: boolean
  onBlur?: () => void
}

const CountryCodeSelector = forwardRef<HTMLInputElement, CountryCodeSelectorProps>(({
  value,
  defaultValue,
  countryIso,
  onChange,
  onCountrySelect,
  name,
  className = '',
  disabled = false,
  onBlur,
}, ref) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCode, setSelectedCode] = useState<string>(value || defaultValue || '+91')
  const [selectedCountryIso, setSelectedCountryIso] = useState<string | null>(countryIso || null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Convert COUNTRY_CODES to array - show each country individually
  const allCountries = Object.entries(COUNTRY_CODES)
    .map(([iso, info]) => ({
      iso,
      ...info,
    }))
    .sort((a, b) => {
      // Sort by country name alphabetically
      return a.name.localeCompare(b.name)
    })

  // Filter based on search query
  const filteredCountries = allCountries.filter((country) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      country.code.toLowerCase().includes(query) ||
      country.name.toLowerCase().includes(query) ||
      country.iso.toLowerCase().includes(query)
    )
  })

  // Get selected country info
  const selectedCountry = selectedCountryIso 
    ? allCountries.find(c => c.iso === selectedCountryIso)
    : allCountries.find(c => c.code === selectedCode) || allCountries.find(c => c.code === '+91')

  useEffect(() => {
    if (value !== undefined) {
      setSelectedCode(value)
      // If countryIso is provided, use it to find the exact country
      if (countryIso) {
        const country = allCountries.find(c => c.iso === countryIso)
        if (country && country.code === value) {
          setSelectedCountryIso(country.iso)
        }
      } else {
        // Find country by code (use first match if multiple countries share code)
        const country = allCountries.find(c => c.code === value)
        if (country) {
          setSelectedCountryIso(country.iso)
        } else {
          // If no match found, try to find by default value
          const defaultCountry = allCountries.find(c => c.code === (defaultValue || '+91'))
          if (defaultCountry) {
            setSelectedCountryIso(defaultCountry.iso)
          }
        }
      }
    }
  }, [value, defaultValue, countryIso])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // Focus search input when dropdown opens
      setTimeout(() => inputRef.current?.focus(), 0)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (iso: string, code: string) => {
    setSelectedCode(code)
    setSelectedCountryIso(iso)
    setIsOpen(false)
    setSearchQuery('')
    onChange?.(code)
    onCountrySelect?.(iso, code)  // Also call the country select callback
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Hidden input for form integration */}
      <input
        ref={ref}
        type="hidden"
        name={name}
        value={selectedCode}
        onBlur={onBlur}
      />

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
          ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-eco-green'}
          ${isOpen ? 'border-eco-green ring-2 ring-eco-green' : ''}
        `}
      >
        <span className="flex items-center gap-2">
          {selectedCountry && (
            <>
              <span>{selectedCountry.flag}</span>
              <span className="font-medium">{selectedCode}</span>
              <span className="text-xs text-gray-600 truncate max-w-[120px]">
                {selectedCountry.name}
              </span>
            </>
          )}
          {!selectedCountry && <span>{selectedCode}</span>}
        </span>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg max-h-80 overflow-hidden">
          {/* Search Input */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search country or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
            />
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-64">
            {filteredCountries.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                No countries found
              </div>
            ) : (
              filteredCountries.map((country) => (
                <div key={country.iso} className="border-b border-gray-100 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => handleSelect(country.iso, country.code)}
                    className={`
                      w-full px-4 py-3 text-left hover:bg-eco-green-light transition-colors
                      ${selectedCountryIso === country.iso ? 'bg-eco-green-light' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-lg flex-shrink-0">{country.flag}</span>
                        <span className="font-mono font-medium text-eco-green flex-shrink-0 w-16">
                          {country.code}
                        </span>
                        <span className="text-sm text-gray-700 truncate">
                          {country.name}
                        </span>
                      </div>
                      {selectedCountryIso === country.iso && (
                        <svg className="h-4 w-4 text-eco-green flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
})

CountryCodeSelector.displayName = 'CountryCodeSelector'

export default CountryCodeSelector

