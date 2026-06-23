import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LINKS } from '../lib/constants'
import { privacyHref, termsHref } from '../lib/route'
import { SocialIcon } from './SocialIcon'

type FooterItem = {
  title: string
  content: FooterItemContent[]
}

type FooterItemContent = {
  content: ReactNode
  href: string
  icon?: ReactNode
}

const footerItems: FooterItem[] = [
  {
    title: 'Ecosystem',
    content: [
      { content: 'Extensions', href: LINKS.ecosystem },
      { content: 'Security', href: LINKS.audits }
    ]
  },
  {
    title: 'Community',
    content: [
      { content: 'Twitter', href: LINKS.twitter, icon: <SocialIcon platform="twitter" className="h-5 w-5" /> },
      { content: 'Discord', href: LINKS.discord, icon: <SocialIcon platform="discord" className="h-5 w-5" /> },
      { content: 'GitHub', href: LINKS.github, icon: <SocialIcon platform="github" className="h-5 w-5" /> },
      { content: 'Medium', href: LINKS.medium, icon: <SocialIcon platform="medium" className="h-5 w-5" /> }
    ]
  }
]

export const Footer = () => {
  return (
    <footer className="w-full bg-pt-purple-600 px-6 pb-20 pt-12 text-pt-purple-100 shadow-[0_-24px_80px_rgba(20,4,48,0.16)] sm:px-12 md:px-16 md:pb-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-16">
        <div className="grid w-full gap-10 text-sm sm:grid-cols-2 md:text-base">
          {footerItems.map((item) => (
            <div key={item.title} className="min-w-0">
              <h2 className="mb-6 font-grotesk text-sm font-semibold uppercase text-pt-teal-dark">
                {item.title}
              </h2>
              <nav className="flex flex-col items-start gap-5">
                {item.content.map((content) => (
                  <FooterLink key={`${item.title}-${content.href}`} href={content.href}>
                    {content.icon}
                    {content.content}
                  </FooterLink>
                ))}
              </nav>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2 text-center text-sm">
          <Link to={termsHref()} className="transition hover:text-white hover:underline">
            Terms of Service
          </Link>
          <Link to={privacyHref()} className="transition hover:text-white hover:underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  )
}

const FooterLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="flex items-center gap-2 transition hover:text-white hover:underline"
  >
    {children}
  </a>
)
