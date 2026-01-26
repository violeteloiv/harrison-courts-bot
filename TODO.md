- [ ] Register Command
    - [ ] Get the specific discord server IDs for which the register command can be run.
        - [ ] Integrate Police Permissions.

- [ ] Move api/trello/constants.ts to config.ts

- [ ] File Case Command
    - [ ] Implement the criminal filing system.
    - [ ] Implement the expungement filing system.
    - [ ] Implement the special cases filing system.
    - [ ] Implement the Appeal Filing System (Needs /setstatus command)
        - [ ] Check if the case is valid and in the system, and that there's been a ruling.
        - [ ] Check if the individual filing is a party to the case, or an attorney for a party.
        - [ ] Create the trello implementations for the appeals filing.
    - [ ] Add a five minute cooldown between running the command.

- [ ] Civil Case Filing Flow
    - [X] File the Civil Case
    - [X] Review the currently pending cases
    - [X] Assign the case to a judge
        - [X] Ability to reassign cases
    - [X] Notice of Appearance
    - [ ] Summons system
        - [ ] Adding person to channel
        - [ ] Removing person from channel
    - [ ] Create filings for the case
    - [ ] Set case status
    - [ ] Minute orders
    - [ ] Rulings
    - [ ] Archiving case
