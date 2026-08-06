$folder = 'c:\Users\yoges\Downloads\epic-toyz'
$old = 'cdn.jsdelivr.net/npm/@supabase/supabase-js@2"'
$new = 'cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"'

Get-ChildItem -Path $folder -Filter '*.html' -Recurse | ForEach-Object {
    $path = $_.FullName
    $content = Get-Content -Raw -Path $path
    if ($content.Contains($old)) {
        $fixed = $content.Replace($old, $new)
        Set-Content -Path $path -Value $fixed -NoNewline
        Write-Host "Fixed: $($_.Name)"
    }
}
Write-Host "All done."
