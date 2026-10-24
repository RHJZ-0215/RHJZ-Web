interface HeaderProps {
  isAdmin: boolean
  onLogin: () => void
  onLogout: () => void
}

/** 顶部标题栏（玻璃效果由 useStableGlass 注入） */
export default function Header({ isAdmin, onLogin, onLogout }: HeaderProps) {
  return (
    <header>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1>君卓博客</h1>
          <p>Junzhuo Blog</p>
        </div>
        {isAdmin ? (
          <button
            className="btn btn-logout"
            onClick={onLogout}
            style={{ background: '#ff4d5e' }}
          >
            <i className="fas fa-sign-out-alt"></i> 退出管理员
          </button>
        ) : (
          <button
            className="btn btn-login"
            onClick={onLogin}
            style={{ background: '#7a4dff' }}
          >
            <i className="fas fa-user-shield"></i> 登录管理员
          </button>
        )}
      </div>
    </header>
  )
}
