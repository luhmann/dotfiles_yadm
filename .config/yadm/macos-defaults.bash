#!/usr/bin/env bash
#
# macOS defaults — only settings that work on modern macOS (Sonoma / Sequoia)
# No sudo required — all settings are user-level defaults.
#
# Usage:
#   bash ~/.config/yadm/macos-defaults.bash
#
# A logout/restart is required for all changes to take effect.

set -euo pipefail

# Close System Settings to prevent it from overriding changes
osascript -e 'tell application "System Settings" to quit'

###############################################################################
# Typing (disable all auto-corrections for coding)                            #
###############################################################################

defaults write NSGlobalDomain NSAutomaticCapitalizationEnabled -bool false
defaults write NSGlobalDomain NSAutomaticDashSubstitutionEnabled -bool false
defaults write NSGlobalDomain NSAutomaticPeriodSubstitutionEnabled -bool false
defaults write NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled -bool false
defaults write NSGlobalDomain NSAutomaticSpellingCorrectionEnabled -bool false

###############################################################################
# Keyboard                                                                    #
###############################################################################

# Disable press-and-hold for keys in favor of key repeat
defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false

# Fastest key repeat rate (1 = ~15ms between repeats; System Settings minimum is 2)
defaults write NSGlobalDomain KeyRepeat -int 1

# Shortest delay before key repeat starts (10 = ~167ms; System Settings minimum is 15)
defaults write NSGlobalDomain InitialKeyRepeat -int 10

# Enable full keyboard access for all controls (Tab in modal dialogs)
defaults write NSGlobalDomain AppleKeyboardUIMode -int 3

###############################################################################
# Trackpad & scroll                                                           #
###############################################################################

# Tap to click
defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad Clicking -bool true
defaults -currentHost write NSGlobalDomain com.apple.mouse.tapBehavior -int 1
defaults write NSGlobalDomain com.apple.mouse.tapBehavior -int 1

# Disable natural (reverse) scrolling
defaults write NSGlobalDomain com.apple.swipescrolldirection -bool false

# Ctrl + scroll wheel to zoom (requires sudo or Accessibility permissions)
# Enable via: System Settings > Accessibility > Zoom > Use scroll gesture

###############################################################################
# General UI/UX                                                               #
###############################################################################

# Always show scrollbars
defaults write NSGlobalDomain AppleShowScrollBars -string "Always"

# Disable focus ring animation
defaults write NSGlobalDomain NSUseAnimatedFocusRing -bool false

# Instant toolbar title rollover
defaults write NSGlobalDomain NSToolbarTitleViewRolloverDelay -float 0

# Fast window resize
defaults write NSGlobalDomain NSWindowResizeTime -float 0.001

# Expand save panel by default
defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode -bool true
defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode2 -bool true

# Expand print panel by default
defaults write NSGlobalDomain PMPrintingExpandedStateForPrint -bool true
defaults write NSGlobalDomain PMPrintingExpandedStateForPrint2 -bool true

# Save to disk (not iCloud) by default
defaults write NSGlobalDomain NSDocumentSaveNewDocumentsToCloud -bool false

# Auto-quit printer app when done
defaults write com.apple.print.PrintingPrefs "Quit When Finished" -bool true

# Disable Gatekeeper "Are you sure you want to open this application?" dialog
defaults write com.apple.LaunchServices LSQuarantine -bool false

# Disable Resume system-wide
defaults write com.apple.systempreferences NSQuitAlwaysKeepsWindows -bool false

# Disable automatic termination of inactive apps
defaults write NSGlobalDomain NSDisableAutomaticTermination -bool true

# Set sidebar icon size to medium
defaults write NSGlobalDomain NSTableViewDefaultSizeMode -int 2

###############################################################################
# Finder                                                                      #
###############################################################################

# Allow quitting via Cmd+Q (hides desktop icons)
defaults write com.apple.finder QuitMenuItem -bool true

# Disable window and Get Info animations
defaults write com.apple.finder DisableAllAnimations -bool true

# Default to home directory in new windows
defaults write com.apple.finder NewWindowTarget -string "PfHm"
defaults write com.apple.finder NewWindowTargetPath -string "file://${HOME}/"

# Show hidden files and all filename extensions
defaults write com.apple.finder AppleShowAllFiles -bool true
defaults write NSGlobalDomain AppleShowAllExtensions -bool true

# Show status bar, path bar, full POSIX path in title
defaults write com.apple.finder ShowStatusBar -bool true
defaults write com.apple.finder ShowPathbar -bool true
defaults write com.apple.finder _FXShowPosixPathInTitle -bool true

# Search the current folder by default
defaults write com.apple.finder FXDefaultSearchScope -string "SCcf"

# Disable warning when changing a file extension
defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false

# Spring loading for directories (no delay)
defaults write NSGlobalDomain com.apple.springing.enabled -bool true
defaults write NSGlobalDomain com.apple.springing.delay -float 0

# Avoid .DS_Store on network and USB volumes
defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true
defaults write com.apple.desktopservices DSDontWriteUSBStores -bool true

# Skip disk image verification
defaults write com.apple.frameworks.diskimages skip-verify -bool true
defaults write com.apple.frameworks.diskimages skip-verify-locked -bool true
defaults write com.apple.frameworks.diskimages skip-verify-remote -bool true

# List view by default
defaults write com.apple.finder FXPreferredViewStyle -string "Nlsv"

# Disable warning before emptying Trash
defaults write com.apple.finder WarnOnEmptyTrash -bool false

# Show ~/Library
chflags nohidden ~/Library
xattr -d com.apple.FinderInfo ~/Library 2>/dev/null || true

# Expand General, Open With, and Sharing & Permissions in Get Info
defaults write com.apple.finder FXInfoPanesExpanded -dict \
	General -bool true \
	OpenWith -bool true \
	Privileges -bool true

###############################################################################
# Dock                                                                        #
###############################################################################

# Icon size 36px
defaults write com.apple.dock tilesize -int 36

# Scale effect for minimize
defaults write com.apple.dock mineffect -string "scale"

# Minimize into application icon
defaults write com.apple.dock minimize-to-application -bool true

# Show indicator lights for open applications
defaults write com.apple.dock show-process-indicators -bool true

# Wipe all default app icons from the Dock
defaults write com.apple.dock persistent-apps -array

# Don't animate opening applications
defaults write com.apple.dock launchanim -bool false

# Fast Mission Control animations
defaults write com.apple.dock expose-animation-duration -float 0.1

# Don't rearrange Spaces based on most recent use
defaults write com.apple.dock mru-spaces -bool false

# Autohide with zero delay and zero animation
defaults write com.apple.dock autohide -bool true
defaults write com.apple.dock autohide-delay -float 0
defaults write com.apple.dock autohide-time-modifier -float 0

# Translucent icons for hidden applications
defaults write com.apple.dock showhidden -bool true

# Don't show recent applications
defaults write com.apple.dock show-recents -bool false

###############################################################################
# Screenshots                                                                 #
###############################################################################

defaults write com.apple.screencapture location -string "${HOME}/Desktop"
defaults write com.apple.screencapture type -string "png"
defaults write com.apple.screencapture disable-shadow -bool true

###############################################################################
# Screen                                                                      #
###############################################################################

# Require password immediately after sleep or screen saver
defaults write com.apple.screensaver askForPassword -int 1
defaults write com.apple.screensaver askForPasswordDelay -int 0

###############################################################################
# TextEdit                                                                    #
###############################################################################

# Plain text mode, UTF-8
defaults write com.apple.TextEdit RichText -int 0
defaults write com.apple.TextEdit PlainTextEncoding -int 4
defaults write com.apple.TextEdit PlainTextEncodingForWrite -int 4

###############################################################################
# Activity Monitor                                                            #
###############################################################################

defaults write com.apple.ActivityMonitor OpenMainWindow -bool true
defaults write com.apple.ActivityMonitor IconType -int 5
defaults write com.apple.ActivityMonitor ShowCategory -int 0
defaults write com.apple.ActivityMonitor SortColumn -string "CPUUsage"
defaults write com.apple.ActivityMonitor SortDirection -int 0

###############################################################################
# Mac App Store & Software Update                                             #
###############################################################################

defaults write com.apple.SoftwareUpdate AutomaticCheckEnabled -bool true
defaults write com.apple.SoftwareUpdate ScheduleFrequency -int 1
defaults write com.apple.SoftwareUpdate AutomaticDownload -int 1
defaults write com.apple.SoftwareUpdate CriticalUpdateInstall -int 1
defaults write com.apple.SoftwareUpdate ConfigDataInstall -int 1
defaults write com.apple.commerce AutoUpdate -bool true

###############################################################################
# Photos                                                                      #
###############################################################################

# Don't open Photos when devices are plugged in
defaults -currentHost write com.apple.ImageCapture disableHotPlug -bool true

###############################################################################
# Restart affected services                                                   #
###############################################################################

for app in "cfprefsd" "Dock" "Finder" "SystemUIServer"; do
	killall "${app}" &>/dev/null || true
done

echo "Done. Log out and back in for all changes to take effect."
