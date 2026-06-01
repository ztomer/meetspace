cask "meetspace" do
  version "1.0.36"
  sha256 :no_check

  on_intel do
    url "https://github.com/ztomer/meetspace/releases/download/v#{version}/Meetspace_#{version}_x64.dmg"
  end
  on_arm do
    url "https://github.com/ztomer/meetspace/releases/download/v#{version}/Meetspace_#{version}_aarch64.dmg"
  end

  name "Meetspace"
  desc "Local-first, privacy-respecting note-taking and meeting assistant"
  homepage "https://github.com/ztomer/meetspace"

  # Installs the app bundle into /Applications
  app "Meetspace.app"

  # Automatically strips the quarantine bit recursively on post-install to bypass Apple Gatekeeper prompts
  postflight do
    system_command "xattr",
                   args: ["-rd", "com.apple.quarantine", "#{appdir}/Meetspace.app"],
                   sudo: false
  end

  # Cleans up application storage and settings on uninstall
  zap trash: [
    "~/.gemini/antigravity",
    "~/Library/Application Support/meetspace",
    "~/Library/Preferences/com.meetspace.desktop.plist",
    "~/Library/Saved Application State/com.meetspace.desktop.savedState",
  ]
end
