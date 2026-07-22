use scripting additions

property apiBaseURL : "__API_BASE_URL__"
property dashboardURL : "__DASHBOARD_URL__"
property allowedCodeCharacters : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"

on run
    try
        set actionDialog to display dialog ¬
            "Install the ThreatScope network sensor on this Mac. No Terminal is required." ¬
            with title "ThreatScope Sensor" ¬
            buttons {"Cancel", "Remove Sensor", "Install Sensor"} ¬
            default button "Install Sensor" cancel button "Cancel" ¬
            with icon note
        set selectedAction to button returned of actionDialog

        if selectedAction is "Remove Sensor" then
            my runHelper("remove", "")
        else if selectedAction is "Install Sensor" then
            my requestCodeAndInstall()
        end if
    on error messageText number errorNumber
        if errorNumber is not -128 then
            display alert "ThreatScope could not complete setup" message messageText as critical
        end if
    end try
end run

on requestCodeAndInstall()
    set response to display dialog ¬
        "Paste the one-time installation code from your ThreatScope dashboard. It expires after ten minutes and works only once." ¬
        with title "Connect this Mac" default answer "" ¬
        buttons {"Cancel", "Continue"} default button "Continue" cancel button "Cancel" ¬
        with icon note
    set enrollmentCode to text returned of response
    if my isValidCode(enrollmentCode) is false then
        display alert "That code is not valid" message "Generate a new installation code in the dashboard, then paste the complete code here." as warning
        return
    end if
    my runHelper("install", enrollmentCode)
end requestCodeAndInstall

on isValidCode(candidate)
    set codeLength to length of candidate
    if codeLength < 32 or codeLength > 64 then return false
    repeat with characterItem in characters of candidate
        if allowedCodeCharacters does not contain (characterItem as text) then return false
    end repeat
    return true
end isValidCode

on runHelper(actionName, enrollmentCode)
    set helperPath to POSIX path of (path to resource "install_helper.sh")
    set sensorPath to POSIX path of (path to resource "threatscope-sensor")
    set codeFile to ""

    try
        if actionName is "install" then
            set codeFile to do shell script "/usr/bin/mktemp -t threatscope-enrollment"
            set fileReference to open for access POSIX file codeFile with write permission
            set eof fileReference to 0
            write enrollmentCode to fileReference as «class utf8»
            close access fileReference
            do shell script "/bin/chmod 600 " & quoted form of codeFile
        end if

        set helperCommand to quoted form of helperPath & space & ¬
            quoted form of actionName & space & ¬
            quoted form of sensorPath & space & ¬
            quoted form of apiBaseURL & space & ¬
            quoted form of codeFile

        set resultMessage to do shell script helperCommand with administrator privileges
        if codeFile is not "" then do shell script "/bin/rm -f " & quoted form of codeFile

        if actionName is "install" then
            set finishDialog to display dialog resultMessage ¬
                with title "ThreatScope is connected" ¬
                buttons {"Done", "Open Dashboard"} default button "Open Dashboard" ¬
                with icon note
            set finishChoice to button returned of finishDialog
            if finishChoice is "Open Dashboard" then open location dashboardURL
        else
            display dialog resultMessage with title "ThreatScope Sensor" buttons {"Done"} default button "Done" with icon note
        end if
    on error messageText number errorNumber
        if codeFile is not "" then
            try
                do shell script "/bin/rm -f " & quoted form of codeFile
            end try
        end if
        error messageText number errorNumber
    end try
end runHelper
