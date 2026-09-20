import { NavLink } from 'react-router-dom'
import './Sidebar.css'

type NavItem = {
  label: string
  path: string
  children?: { label: string; path: string }[]
}

const nav: { group: string; items: NavItem[] }[] = [
  {
    group: 'Content',
    items: [
      { label: 'Athletes', path: '/athletes' },
      { label: 'Sporting Events', path: '/sporting-events' },
      {
        label: 'Games / Competitions',
        path: '/games',
        children: [
          { label: 'Heats & Prizes', path: '/games/heats-prizes' },
          { label: 'Schedule', path: '/games/schedule' },
          { label: 'Results Entry', path: '/games/results-entry' },
          { label: 'Notifications', path: '/games/notifications' },
          { label: 'Featured Athletes', path: '/games/featured-athletes' },
        ],
      },
      { label: 'Media', path: '/media' },
    ],
  },
  {
    group: 'Reference Data',
    items: [{ label: 'Countries', path: '/countries' }],
  },
  {
    group: 'Configuration',
    items: [
      { label: 'System Lists', path: '/system-lists' },
      { label: 'System Variables', path: '/system-variables' },
      { label: 'System Audit', path: '/system-audit' },
    ],
  },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark" />
        <div>
          <div className="brand-name">Enhanced Games</div>
          <div className="brand-subtitle">Admin</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {nav.map((section) => (
          <div className="nav-section" key={section.group}>
            <div className="nav-section-label">{section.group}</div>
            {section.items.map((item) => (
              <div key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    'nav-item' + (isActive ? ' nav-item-active' : '')
                  }
                >
                  {item.label}
                </NavLink>
                {item.children && (
                  <div className="nav-children">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={({ isActive }) =>
                          'nav-item nav-item-child' +
                          (isActive ? ' nav-item-active' : '')
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="user-avatar" />
        <div>
          <div className="user-name">A. Staff Member</div>
          <div className="user-meta">Signed in via SSO</div>
        </div>
      </div>
    </aside>
  )
}
