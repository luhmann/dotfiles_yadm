;;; $DOOMDIR/config.el -*- lexical-binding: t; -*-

;; Place your private configuration here! Remember, you do not need to run 'doom
;; sync' after modifying this file!


;; Some functionality uses this to identify you, e.g. GPG configuration, email
;; clients, file templates and snippets. It is optional.
;; (setq user-full-name "John Doe"
;;       user-mail-address "john@doe.com")

;; Doom exposes five (optional) variables for controlling fonts in Doom:
;;
;; - `doom-font' -- the primary font to use
;; - `doom-variable-pitch-font' -- a non-monospace font (where applicable)
;; - `doom-big-font' -- used for `doom-big-font-mode'; use this for
;;   presentations or streaming.
;; - `doom-symbol-font' -- for symbols
;; - `doom-serif-font' -- for the `fixed-pitch-serif' face
;;
;; See 'C-h v doom-font' for documentation and more examples of what they
;; accept. For example:
;;
;;(setq doom-font (font-spec :family "Fira Code" :size 12 :weight 'semi-light)
;;      doom-variable-pitch-font (font-spec :family "Fira Sans" :size 13))
;;
;; If you or Emacs can't find your font, use 'M-x describe-font' to look them
;; up, `M-x eval-region' to execute elisp code, and 'M-x doom/reload-font' to
;; refresh your font settings. If Emacs still can't find your font, it likely
;; wasn't installed correctly. Font issues are rarely Doom issues!

;; There are two ways to load a theme. Both assume the theme is installed and
;; available. You can either set `doom-theme' or manually load a theme with the
;; `load-theme' function. This is the default:
(setq doom-theme 'doom-outrun-electric)

;; This determines the style of line numbers in effect. If set to `nil', line
;; numbers are disabled. For relative line numbers, set this to `relative'.
(setq display-line-numbers-type t)

(setq doom-font (font-spec :family "MonoLisa" :size 13))
(setq-default line-spacing 3)

(setq org-src-fontify-natively t)

;; do not ask for confirmation on close
(setq confirm-kill-emacs nil)

;; If you use `org' and don't want your org files in the default location below,
;; change `org-directory'. It must be set before org loads!
(setq org-directory "~/Documents/org/")


;; Whenever you reconfigure a package, make sure to wrap your config in an
;; `after!' block, otherwise Doom's defaults may override your settings. E.g.
;;
;;   (after! PACKAGE
;;     (setq x y))
;;
;; The exceptions to this rule:
;;
;;   - Setting file/directory variables (like `org-directory')
;;   - Setting variables which explicitly tell you to set them before their
;;     package is loaded (see 'C-h v VARIABLE' to look up their documentation).
;;   - Setting doom variables (which start with 'doom-' or '+').
;;
;; Here are some additional functions/macros that will help you configure Doom.
;;
;; - `load!' for loading external *.el files relative to this one
;; - `use-package!' for configuring packages
;; - `after!' for running code after a package has loaded
;; - `add-load-path!' for adding directories to the `load-path', relative to
;;   this file. Emacs searches the `load-path' when you load packages with
;;   `require' or `use-package'.
;; - `map!' for binding new keys
;;
;; To get information about any of these functions/macros, move the cursor over
;; the highlighted symbol at press 'K' (non-evil users must press 'C-c c k').
;; This will open documentation for it, including demos of how they are used.
;; Alternatively, use `C-h o' to look up a symbol (functions, variables, faces,
;; etc).
;;
;; You can also try 'gd' (or 'C-c c d') to jump to their definition and see how
;; they are implemented.
(setenv "PATH" (concat "/opt/homebrew/bin:" (getenv "PATH")))
(add-to-list 'exec-path "/opt/homebrew/bin")


(setq org-log-done 'time)

(use-package! org-transclusion
  :after org
  :config
  (add-to-list 'org-transclusion-extensions 'org-transclusion-http)
  (map! :map org-mode-map
        :localleader
        (:prefix ("t" . "toggle")
         "T" #'org-transclusion-mode)))

(after! org-transclusion
  ;; Ensure external extension and its dependency are on `load-path'.
  (dolist (pkg '("plz" "org-transclusion-http"))
    (let ((pkg-path
           (expand-file-name
            (format "straight/build-%d.%d/%s"
                    emacs-major-version emacs-minor-version pkg)
            doom-local-dir)))
      (when (file-directory-p pkg-path)
        (add-to-list 'load-path pkg-path))))
  (unless (require 'org-transclusion-http nil t)
    (message "org-transclusion-http not found; run doom sync")))

(after! org
  (require 'org-tempo)
  (let ((d2-mode-path
         (expand-file-name
          (format "straight/build-%d.%d/d2-mode"
                  emacs-major-version emacs-minor-version)
          doom-local-dir)))
    (when (file-directory-p d2-mode-path)
      (add-to-list 'load-path d2-mode-path)))
  (require 'd2-mode nil t)
  (setf (alist-get "typescript" org-src-lang-modes nil nil #'equal) 'typescript)
  (setf (alist-get "d2" org-src-lang-modes nil nil #'equal) 'd2)
  (org-babel-do-load-languages
   'org-babel-load-languages
   '((js . t)
     (ts .t)
     (typescript . t)
     (python . t)
     (shell . t)
     ))
)

(after! ob
  (defvar org-babel-default-header-args:d2
    '((:results . "file") (:exports . "results"))
    "Default header arguments for D2 source blocks.")

  (defun org-babel-execute:d2 (body params)
    "Execute a D2 source block BODY with header PARAMS."
    (let* ((d2-bin (or (executable-find "d2") "/opt/homebrew/bin/d2"))
           (do-export (member "file" (cdr (assq :result-params params))))
           (out-file (if do-export
                         (or (cdr (assq :file params))
                             (error "No :file provided but :results set to file"))
                       (org-babel-temp-file "d2-" ".svg")))
           (cmdline (or (cdr (assq :cmdline params)) ""))
           (in-file (org-babel-temp-file "d2-" ".d2"))
           (cmd (format "%s %s %s %s"
                        (shell-quote-argument d2-bin)
                        cmdline
                        (org-babel-process-file-name in-file)
                        (org-babel-process-file-name out-file))))
      (with-temp-file in-file
        (insert body))
      (org-babel-eval cmd "")
      (unless do-export
        (with-temp-buffer
          (insert-file-contents out-file)
          (buffer-substring-no-properties (point-min) (point-max))))))

  ;; Satisfy Doom's lazy babel loader that tries (require 'ob-d2).
  (provide 'ob-d2))

(after! org
  (setq dgstage-notes-file (expand-file-name "notes_dgstage.org" org-directory))
  (add-to-list 'org-capture-templates
             '("d" "DGStage Note" entry
               (file+headline dgstage-notes-file "DGStage")
               "* [%<%Y-%m-%d %H:%M>] %? :dgstage:\n %i\n %a\n"
               )
  ))

(after! plantuml-mode
  (setq plantuml-default-exec-mode 'executable
        plantuml-executable-path (or (executable-find "plantuml")
                                     "/opt/homebrew/bin/plantuml")))

(after! ob-plantuml
  ;; Use upstream ob-plantuml executor. Doom's override can produce empty
  ;; #+RESULTS: blocks for :file outputs in this setup.
  (when (fboundp '+plantuml-org-babel-execute:plantuml-a)
    (advice-remove #'org-babel-execute:plantuml
                   #'+plantuml-org-babel-execute:plantuml-a))
  (setq org-plantuml-exec-mode 'plantuml
        org-plantuml-executable-path (or (executable-find "plantuml")
                                         "/opt/homebrew/bin/plantuml")))

(after! artist
  ;; Keep artist-mode inside current major mode (e.g. org-mode) to avoid
  ;; Org internals running in picture-mode.
  (setq artist-picture-compatibility nil))

(after! ox
  (dolist (pkg '("pcache" "logito" "marshal" "gh" "gist" "ox-gist"))
    (let ((pkg-path
           (expand-file-name
            (format "straight/build-%d.%d/%s"
                    emacs-major-version emacs-minor-version pkg)
            doom-local-dir)))
      (when (file-directory-p pkg-path)
        (add-to-list 'load-path pkg-path))))
  (require 'ox-gist)
  (map! :map org-mode-map
        :localleader
        (:prefix ("e" . "export")
         "g" #'org-gist-export-to-gist)))
